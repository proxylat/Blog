import subprocess
from pathlib import Path
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.chunks, self._skip = [], False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self.chunks.append(data)

def collect_chars(site_dir):
    chars = set()
    for f in Path(site_dir).rglob('*.html'):
        p = TextExtractor()
        p.feed(f.read_text(encoding='utf-8', errors='ignore'))
        for chunk in p.chunks:
            chars.update(chunk)
    chars.update(chr(c) for c in range(0x20, 0x100))
    chars.update('→←↑↓⇒≤≥≠±×÷•…—–\u201c\u201d\u2018\u2019`~|\\')
    chars -= {'\n', '\r', '\t', '\x0c'}
    return ''.join(sorted(chars))

FONT_SRC = 'font/CPMono_v07_Plain.woff2'
FONT_OUT = '_site/font/CPMono_v07_Plain.woff2'

text = collect_chars('_site')
print()
print(f'Font Subset Optimization:')
print(f'[subset] {len(text)} total glyphs')

subprocess.run([
    'pyftsubset', FONT_SRC,
    f'--text={text}',
    '--flavor=woff2',
    f'--output-file={FONT_OUT}',
    '--layout-features=*',
], check=True)

kb_in  = Path(FONT_SRC).stat().st_size / 1024
kb_out = Path(FONT_OUT).stat().st_size / 1024
print(f'[subset] {kb_in:.1f}KB → {kb_out:.1f}KB ({100 - kb_out / kb_in * 100:.0f}% lower)')