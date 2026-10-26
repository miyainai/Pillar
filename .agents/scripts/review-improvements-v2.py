from pathlib import Path
import pymupdf

source = Path("attached_assets/Oct-26_Hackathon_Improvements_v2_1792856624069.pdf")
out = Path("generated-artifacts/improvements-reference-v2")
out.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(source)
print(f"Pages: {len(doc)}")
for i, page in enumerate(doc):
    page.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6)).save(out / f"page-{i+1}.png")
    imgs = page.get_images(full=True)
    print(f"Page {i+1}: {len(imgs)} images, size {page.rect}")
    for j, img in enumerate(imgs):
        data = doc.extract_image(img[0])
        (out / f"page-{i+1}-img-{j+1}.{data['ext']}").write_bytes(data["image"])
        print(f"  image {j+1}: {data['width']}x{data['height']} {data['ext']}")
