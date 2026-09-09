"""Build a small homepage face from the existing licensed report font."""
from pathlib import Path
from html.parser import HTMLParser
from fontTools import subset
root=Path(__file__).resolve().parents[1]
class Text(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]
    def handle_data(self,data): self.parts.append(data)
p=Text(); p.feed((root/'index.html').read_text(encoding='utf-8').split('id="step-upload"')[0])
chars=''.join(p.parts)+''.join(chr(i) for i in range(32,127))
options=subset.Options(); options.flavor='woff2'; options.layout_features=['*']
font=subset.load_font(str(root/'web/assets/fonts/shiseji-report-serif.woff2'),options)
s=subset.Subsetter(options=options); s.populate(text=chars); s.subset(font)
out=root/'web/assets/fonts/shiseji-home-serif.woff2'; subset.save_font(font,str(out),options)
print(out.name,out.stat().st_size)
