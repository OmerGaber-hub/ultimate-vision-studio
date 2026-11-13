# -*- coding: utf-8 -*-
"""
Ultimate Vision Studio - Full Exhaustive PDF User Manual Generator
Parses the complete User_Manual.md (all 1000+ lines, all sections, all parameters, and all workflows),
embeds all 37 high-res base64 screenshots directly under their respective sections,
applies publication-grade typography (Cairo & Tajawal), and compiles it to PDF via Chrome Headless.
"""
import os
import re
import sys
import base64
import urllib.parse
import subprocess
import tempfile
import markdown

def image_to_base64(img_path):
    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            return f"data:image/png;base64,{encoded}"
    return ""

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    md_file = os.path.join(base_dir, "User_Manual.md")
    shots_dir = os.path.join(base_dir, "لقطات شاشة لبعض الواجهات المحرر")
    
    if not os.path.exists(md_file):
        print(f"Error: {md_file} does not exist.")
        sys.exit(1)
        
    with open(md_file, "r", encoding="utf-8") as f:
        md_content = f.read()

    # Pre-encode all 37 screenshots
    imgs = {}
    if os.path.exists(shots_dir):
        for fname in os.listdir(shots_dir):
            if fname.lower().endswith(".png"):
                full_path = os.path.join(shots_dir, fname)
                b64 = image_to_base64(full_path)
                imgs[fname] = b64
                imgs[urllib.parse.quote(fname)] = b64
    print(f"Loaded and base64-encoded {len(imgs)//2} images.")

    # Custom replacer for markdown images to ensure full figure container and captions
    def replace_image(match):
        caption = match.group(1).strip()
        img_url = match.group(2).strip()
        # Decode URL path
        decoded_name = os.path.basename(urllib.parse.unquote(img_url))
        raw_name = os.path.basename(img_url)
        
        b64 = imgs.get(decoded_name) or imgs.get(raw_name) or ""
        if b64:
            return f'\n\n<div class="figure-container"><img src="{b64}" alt="{caption}" /><div class="figure-caption">{caption}</div></div>\n\n'
        else:
            return f'\n\n<div class="img-missing">[الصورة المفقودة: {decoded_name}]</div>\n\n'

    # Replace markdown images ! [caption] (url)
    img_pattern = re.compile(r'!\[(.*?)\]\((.*?)\)')
    processed_md = img_pattern.sub(replace_image, md_content)

    # Convert markdown to full HTML
    html_body = markdown.markdown(
        processed_md,
        extensions=['tables', 'fenced_code', 'nl2br']
    )

    full_html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>دليل المستخدم لمحرر Ultimate Vision Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  @page {{
    size: A4;
    margin: 16mm 14mm 16mm 14mm;
    @bottom-right {{
      content: counter(page);
      font-family: 'Cairo', sans-serif;
      font-size: 9pt;
      color: #718096;
    }}
    @bottom-left {{
      content: "Ultimate Vision Studio — دليل المستخدم الرسمي المعتمد";
      font-family: 'Cairo', sans-serif;
      font-size: 8pt;
      color: #a0aec0;
    }}
  }}

  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  body {{
    font-family: 'Cairo', 'Tajawal', sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.65;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
  }}

  h1, h2, h3, h4, h5 {{
    font-family: 'Cairo', sans-serif;
    color: #0f172a;
    margin-top: 16pt;
    margin-bottom: 8pt;
    font-weight: 800;
  }}

  h1 {{
    font-size: 20pt;
    border-bottom: 2.5px solid #8b5cf6;
    padding-bottom: 6px;
    color: #4c1d95;
    text-align: center;
    margin-top: 0;
    margin-bottom: 6pt;
  }}

  h2 {{
    font-size: 13pt;
    border-right: 4.5px solid #8b5cf6;
    padding-right: 8px;
    color: #581c87;
    margin-top: 20pt;
    background: #faf5ff;
    padding-top: 5px;
    padding-bottom: 5px;
    border-radius: 0 4px 4px 0;
    page-break-after: avoid;
  }}

  h3 {{
    font-size: 11pt;
    color: #6b21a8;
    font-weight: 700;
    margin-top: 14pt;
    border-bottom: 1px solid #f3e8ff;
    padding-bottom: 3px;
    page-break-after: avoid;
  }}

  h4 {{
    font-size: 10pt;
    color: #334155;
    font-weight: 700;
    margin-top: 10pt;
    page-break-after: avoid;
  }}

  p {{
    margin-bottom: 7pt;
    text-align: justify;
    line-height: 1.65;
  }}

  ul, ol {{
    padding-right: 20px;
    margin-top: 4pt;
    margin-bottom: 8pt;
  }}

  li {{
    margin-bottom: 4pt;
  }}

  .figure-container {{
    margin: 14pt auto;
    text-align: center;
    page-break-inside: avoid;
  }}

  .figure-container img {{
    max-width: 95%;
    max-height: 380px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  }}

  .figure-caption {{
    font-size: 8.5pt;
    color: #475569;
    font-weight: 600;
    margin-top: 6px;
    font-family: 'Cairo', sans-serif;
  }}

  .img-missing {{
    padding: 10px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    text-align: center;
    font-size: 8.5pt;
    margin: 10pt 0;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }}

  th, td {{
    border: 1px solid #cbd5e1;
    padding: 5pt 7pt;
    text-align: right;
    vertical-align: top;
  }}

  th {{
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
  }}

  tr:nth-child(even) {{
    background-color: #f8fafc;
  }}

  code {{
    font-family: 'Courier New', Courier, monospace;
    font-size: 8.5pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #6b21a8;
    border: 1px solid #e2e8f0;
  }}

  pre {{
    background: #0f172a;
    color: #f8fafc;
    padding: 10pt;
    border-radius: 6px;
    font-size: 8pt;
    overflow-x: auto;
    direction: ltr;
    text-align: left;
    margin: 10pt 0;
    page-break-inside: avoid;
  }}

  pre code {{
    background: transparent;
    color: inherit;
    border: none;
    padding: 0;
  }}

  hr {{
    border: 0;
    border-top: 1.5px solid #e2e8f0;
    margin: 18pt 0;
  }}

  strong {{
    color: #0f172a;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

    html_file = os.path.join(base_dir, "manual_print.html")
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"HTML manual generated with full content: {html_file} ({len(full_html)} chars)")

    # Compile to PDF using Chrome Headless
    pdf_out = os.path.join(base_dir, "Ultimate_Vision_Studio_User_Manual.pdf")
    temp_data_dir = tempfile.mkdtemp()

    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]
    browser_exe = None
    for p in chrome_paths:
        if os.path.exists(p):
            browser_exe = p
            break

    if not browser_exe:
        print("Error: Neither Chrome nor Edge executable was found.")
        sys.exit(1)

    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        f"--user-data-dir={temp_data_dir}",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_out}",
        html_file
    ]

    print(f"Generating full PDF with: {browser_exe}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(pdf_out):
        size_bytes = os.path.getsize(pdf_out)
        print(f"SUCCESS: Full PDF created successfully at: {pdf_out} ({size_bytes / (1024*1024):.2f} MB)")
    else:
        print(f"Error generating PDF. Stderr: {res.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    main()
