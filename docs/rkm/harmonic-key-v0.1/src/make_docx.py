import pypandoc, docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
OUT="/workspace/forge-harmonic-key"
D=f"{OUT}/Forge_Harmonic_Key_and_Packet_Spec_v0.1.docx"
pypandoc.convert_file(f"{OUT}/Forge_Harmonic_Key_and_Packet_Spec_v0.1.md","docx",outputfile=D,extra_args=["--toc","--toc-depth=2"])
d=docx.Document(D)
for s in d.sections:
    s.orientation=WD_ORIENT.LANDSCAPE; s.page_width, s.page_height = Inches(11), Inches(8.5)
    for m in ("left_margin","right_margin","top_margin","bottom_margin"): setattr(s,m,Inches(0.6))
for st in ("Normal","Body Text","First Paragraph","Compact"):
    try: d.styles[st].font.name="Calibri"; d.styles[st].font.size=Pt(10.5)
    except KeyError: pass
for st in ("Source Code","Verbatim Char"):
    try: d.styles[st].font.size=Pt(8)
    except KeyError: pass
def border(tbl):
    tblPr=tbl._tbl.tblPr; b=OxmlElement('w:tblBorders')
    for e in ("top","left","bottom","right","insideH","insideV"):
        x=OxmlElement(f'w:{e}'); x.set(qn('w:val'),'single'); x.set(qn('w:sz'),'4'); x.set(qn('w:color'),'999999'); b.append(x)
    tblPr.append(b)
for tbl in d.tables:
    border(tbl)
    ncol=len(tbl.columns); fs=Pt(7.5 if ncol>=9 else 9)
    for ri,row in enumerate(tbl.rows):
        for c in row.cells:
            if ri==0:
                sh=OxmlElement('w:shd'); sh.set(qn('w:val'),'clear'); sh.set(qn('w:fill'),'DCE6F1'); c._tc.get_or_add_tcPr().append(sh)
            for p in c.paragraphs:
                for r in p.runs:
                    r.font.size=fs
                    if ri==0: r.font.bold=True
d.save(D); print("saved")
