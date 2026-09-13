import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from xml.sax.saxutils import escape
from zipfile import ZipFile


SCRIPT = Path(__file__).with_name('convert_flop_cbet.py')
TEXTURES = {'boards': [
    {'board': 'AsAh7s', 'source_board': 'AdAc7c', 'texture': 'Paired'},
    {'board': 'AsKs3h', 'source_board': 'AcKc3d', 'texture': 'ABx'},
]}
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def workbook(path, rows):
    """Small independent workbook: sheet path is deliberately not sheet1.xml."""
    cells = []
    for index, values in enumerate(rows, 2):
        content = ''.join(
            f'<c r="{column}{index}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'
            for column, value in zip('BCDEFGH', values)
        )
        cells.append(f'<row r="{index}">{content}</row>')
    with ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets><sheet name="DATA_BvB" sheetId="9" r:id="rId3"/></sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Target="worksheets/sheet42.xml" Type="{REL}/worksheet"/></Relationships>')
        archive.writestr('xl/worksheets/sheet42.xml', f'<worksheet xmlns="{NS}" xmlns:r="{REL}"><sheetData>{"".join(cells)}</sheetData><hyperlinks><hyperlink ref="H2" r:id="link1"/></hyperlinks></worksheet>')
        archive.writestr('xl/worksheets/_rels/sheet42.xml.rels', f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="link1" Type="{REL}/hyperlink" Target="https://drive.google.com/file/d/example/view" TargetMode="External"/></Relationships>')


class ConversionTest(unittest.TestCase):
    def run_conversion(self, rows, previous=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        source = Path(temporary.name) / 'source.xlsx'
        output = Path(temporary.name) / 'data.json'
        texture_path = Path(temporary.name) / 'textures.json'
        texture_path.write_text(json.dumps(TEXTURES))
        workbook(source, rows)
        if previous is not None:
            output.write_text(previous)
        result = subprocess.run([sys.executable, str(SCRIPT), str(source), str(output), '--textures', str(texture_path)], capture_output=True, text=True)
        return result, output

    def test_converts_suits_stab_allin_and_keeps_source_corrections(self):
        result, output = self.run_conversion([
            ['GTO', '50BB', 'SBvsBB C-Bet', 'SBvsBB C-Bet', 'A♠ A♥ 7♠', '25%', '89,6'],
            ['Maniac', '20BB', 'BBvsSB Stab', 'BBvsSB Stab', 'K♣ T♦ 2♥', 'ALLIN', '99.9.'],
        ])
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(output.read_text())
        self.assertEqual(data['boards'][0], {'id': 'AsAh7s', 'cards': ['As', 'Ah', '7s'], 'textures': ['Paired']})
        first, second = data['records']
        self.assertEqual((first['spot'], first['hero'], first['villain'], first['action']), ('blind-war', 'SB', 'BB', 'cbet'))
        self.assertEqual(first['size'], {'kind': 'pot', 'pct': 25})
        self.assertEqual(first['frequency_pct'], 89.6)
        self.assertEqual(first['source'], {'sheet': 'DATA_BvB', 'row': 2, 'url': 'https://drive.google.com/file/d/example/view'})
        self.assertEqual((second['action'], second['size'], second['frequency_pct']), ('stab', {'kind': 'all-in'}, 99.9))
        self.assertEqual(data['corrections'], [
            {'sheet': 'DATA_BvB', 'cell': 'H2', 'original': '89,6', 'normalized': 89.6},
            {'sheet': 'DATA_BvB', 'cell': 'H3', 'original': '99.9.', 'normalized': 99.9},
        ])

    def test_texture_matching_retains_rank_suit_relationships(self):
        from convert_flop_cbet import attach_textures
        boards = [{'id': board} for board in ['7cAdAc', 'Ac7dAh', 'AsKs3h', 'AsKh3s', 'AsKs3s']]
        attach_textures(boards, TEXTURES)
        self.assertEqual([board['textures'] for board in boards], [['Paired'], [], ['ABx'], [], []])

    def test_invalid_input_keeps_previous_output(self):
        base = ['GTO', '50BB', 'SBvsBB C-Bet', 'SBvsBB C-Bet', 'A♠ A♥ 7♠', '25%', '50']
        bad_rows = [base[:-1] + ['100.1'], base[:-1] + ['99oops'], base[:4] + ['A♠ A♠ 7♠'] + base[5:], base[:5] + ['???', '50']]
        for row in bad_rows:
            with self.subTest(row=row):
                result, output = self.run_conversion([row], previous='original')
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(output.read_text(), 'original')
        result, output = self.run_conversion([base, base], previous='original')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Duplicate', result.stderr)
        self.assertEqual(output.read_text(), 'original')


if __name__ == '__main__':
    unittest.main()
