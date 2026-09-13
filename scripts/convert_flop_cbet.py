#!/usr/bin/env python3
"""Convert the workbook's DATA_* sheets, never the currently selected display cells.

Usage: python3 scripts/convert_flop_cbet.py source.xlsx public/tournament-flop-cbet.json
Only the Python standard library is needed. No network requests or formula execution.
"""

import argparse
import hashlib
import json
from itertools import permutations
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import tempfile
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from zipfile import ZipFile


NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
SHEETS = {
    'DATA_SRP': ('srp-ip', 'SRP_IP'),
    'DATA_SRPOOP': ('srp-oop', 'SRP_OOP'),
    'DATA_BvB': ('blind-war', None),
    'DATA_3BPOOP': ('3bp-oop', '3BP_OOP'),
    'DATA_3BPIP': ('3bp-ip', '3BP_IP'),
    'DATA_4BPOOP': ('4bp-oop', '4BP_OOP'),
    'DATA_4BPIP': ('4bp-ip', '4BP_IP'),
}
SUITS = str.maketrans({'♠': 's', '♥': 'h', '♦': 'd', '♣': 'c'})
# Explicit repairs for the supplied workbook, not a generic permissive number parser.
FREQUENCY_REPAIRS = {'89,6': 89.6, '46,3': 46.3, '99.9.': 99.9}


def relationships(archive, part):
    path = PurePosixPath(part)
    rel_path = str(path.parent / '_rels' / (path.name + '.rels'))
    if rel_path not in archive.namelist():
        return {}
    return {item.attrib['Id']: item.attrib for item in ET.fromstring(archive.read(rel_path))}


def read_cells(row, strings):
    values = {}
    for cell in row.findall('s:c', NS):
        column = re.sub(r'\d', '', cell.attrib['r'])
        value = cell.find('s:v', NS)
        if cell.get('t') == 'inlineStr':
            values[column] = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
        elif value is not None and value.text is not None:
            values[column] = strings[int(value.text)] if cell.get('t') == 's' else value.text
    return values


def board_signature(board):
    """Ignore card order and suit names, retaining ranks and suit relationships."""
    if not re.fullmatch(r'(?:[2-9TJQKA][shdc]){3}', board):
        raise ValueError(f'Invalid texture board: {board}')
    cards = [board[i:i + 2] for i in range(0, 6, 2)]
    if len(set(cards)) != 3:
        raise ValueError(f'Duplicate texture card: {board}')
    return min(tuple(sorted(card[0] + dict(zip('shdc', suits))[card[1]] for card in cards))
               for suits in permutations('shdc'))


def attach_textures(boards, snapshot):
    textures = {}
    for item in snapshot['boards']:
        signature = board_signature(item['board'])
        if signature != board_signature(item['source_board']):
            raise ValueError(f"Texture source does not match: {item['board']}")
        if not isinstance(item['texture'], str) or not item['texture'].strip() or signature in textures:
            raise ValueError('Invalid or duplicate texture mapping')
        textures[signature] = item['texture']
    for board in boards:
        texture = textures.get(board_signature(board['id']))
        board['textures'] = [texture] if texture else []


def convert(source, texture_path=None):
    texture_path = texture_path or Path(__file__).with_name('data').joinpath('flop-board-textures.json')
    if not texture_path.is_file():
        raise ValueError('Missing texture mapping: run npm run decrypt with DATA_KEY first, or pass --textures')
    snapshot = json.loads(texture_path.read_text())
    boards, records, corrections, keys = {}, [], [], set()
    with ZipFile(source) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('.//s:t', NS))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        workbook_rels = relationships(archive, 'xl/workbook.xml')
        for sheet in workbook.findall('s:sheets/s:sheet', NS):
            name = sheet.attrib['name']
            if name not in SHEETS:
                continue
            spot, source_type = SHEETS[name]
            target = workbook_rels[sheet.attrib[f'{{{REL}}}id']]['Target']
            part = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            document = ET.fromstring(archive.read(part))
            links = relationships(archive, part)
            cell_links = {
                link.attrib['ref']: links[link.attrib[f'{{{REL}}}id']]['Target']
                for link in document.findall('s:hyperlinks/s:hyperlink', NS)
                if f'{{{REL}}}id' in link.attrib
            }
            for row in document.findall('s:sheetData/s:row', NS):
                row_number = int(row.attrib['r'])
                if row_number == 1:
                    continue
                values = read_cells(row, strings)
                if not any(values.get(c, '').strip() for c in 'BCDEFGH'):
                    continue
                location = f'{name}!{row_number}'
                if any(not values.get(c, '').strip() for c in 'BCDEFGH'):
                    raise ValueError(f'Missing required cell: {location}')
                profile, stack, kind, position, board, size, frequency = (values[c].strip() for c in 'BCDEFGH')
                if profile not in ('GTO', 'Calling Station', 'Maniac') or stack not in ('20BB', '35BB', '50BB'):
                    raise ValueError(f'Unsupported profile or stack: {location}')
                if spot.startswith('4bp') and stack != '50BB':
                    raise ValueError(f'4BP must use 50BB: {location}')
                if source_type is not None and kind != source_type:
                    raise ValueError(f'Unexpected spot type: {location}')
                if spot == 'blind-war' and (kind != position or position not in ('SBvsBB C-Bet', 'BBvsSB Stab')):
                    raise ValueError(f'Unexpected Blind War action: {location}')
                match = re.fullmatch(r'(UTG|HJ|CO|BTN|SB|BB)vs(UTG|HJ|CO|BTN|SB|BB)(?: C-Bet| Stab)?', position)
                if not match or match[1] == match[2]:
                    raise ValueError(f'Invalid position: {location}')
                compact = re.sub(r'\s+', '', board.translate(SUITS))
                if not re.fullmatch(r'(?:[2-9TJQKA][shdc]){3}', compact):
                    raise ValueError(f'Invalid board: {location}')
                cards = [compact[i:i + 2] for i in range(0, 6, 2)]
                if len(set(cards)) != 3:
                    raise ValueError(f'Duplicate board card: {location}')
                boards.setdefault(compact, {'id': compact, 'cards': cards})
                if size == 'ALLIN':
                    bet_size = {'kind': 'all-in'}
                elif size in ('10%', '25%', '50%', '75%', '100%'):
                    bet_size = {'kind': 'pot', 'pct': int(size[:-1])}
                else:
                    raise ValueError(f'Invalid size: {location}')
                if frequency in FREQUENCY_REPAIRS:
                    normalized = FREQUENCY_REPAIRS[frequency]
                    corrections.append({'sheet': name, 'cell': f'H{row_number}', 'original': frequency, 'normalized': normalized})
                elif re.fullmatch(r'\d+(?:\.\d+)?', frequency):
                    normalized = float(frequency)
                else:
                    raise ValueError(f'Invalid frequency: {location}')
                if not 0 <= normalized <= 100:
                    raise ValueError(f'Frequency outside 0–100: {location}')
                action = 'stab' if position.endswith(' Stab') else 'cbet'
                key = (spot, profile, stack, match[1], match[2], action, compact)
                if key in keys:
                    raise ValueError(f'Duplicate strategy key: {location}')
                keys.add(key)
                url = cell_links.get(f'H{row_number}')
                if url and (urlparse(url).scheme != 'https' or urlparse(url).hostname != 'drive.google.com'):
                    raise ValueError(f'Unexpected source URL: {location}')
                records.append({
                    'spot': spot, 'profile': profile, 'stack_bb': int(stack[:-2]),
                    'hero': match[1], 'villain': match[2], 'action': action,
                    'board_id': compact, 'size': bet_size, 'frequency_pct': normalized,
                    'source': {'sheet': name, 'row': row_number, 'url': url},
                })
    if not records:
        raise ValueError('No strategy records found in DATA sheets')
    attach_textures(boards.values(), snapshot)
    return {
        'schema_version': 1,
        'source': {'workbook': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()},
        'boards': list(boards.values()), 'records': records, 'corrections': corrections,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--textures', type=Path, help='Decrypted texture mapping JSON')
    args = parser.parse_args()
    data = convert(args.source, args.textures)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Validation finishes before creating/replacing any output.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=args.output.parent, delete=False) as handle:
            temporary = handle.name
            json.dump(data, handle, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
            handle.write('\n')
        os.replace(temporary, args.output)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Converted {len(data['records'])} records, {len(data['boards'])} boards, {len(data['corrections'])} corrections: {args.output}")


if __name__ == '__main__':
    main()
