from pathlib import Path
import fitz

source = Path("attached_assets/Oct-26_Hackathon_Improvements_v1_1792854604138.pdf")
out = Path("generated-artifacts/improvements-reference")
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(source)
print(f"Pages: {len(doc)}")
for i, page in enumerate(doc):
    page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6)).save(out / f"page-{i+1}.png")
    print(f"Page {i+1}: {len(page.get_images())} images")
