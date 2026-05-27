import shutil
import subprocess
from pathlib import Path
from urllib.request import urlretrieve


ROOT = Path(__file__).resolve().parents[1]
EXTRACTOR = ROOT / 'scripts' / 'extract_flybanner_print_area.py'
OUTPUT_DIR = ROOT / 'assets' / 'images' / 'product-svg'
TMP_DIR = ROOT / 'tmp' / 'supplier-product-svgs'


PRODUCTS = [
    {
        'slug': 'bandeiras-para-manifestacoes-20-x-30-cm',
        'title': 'Bandeiras para Manifestacoes 20 x 30 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Bandeiras-Paus-20x30cm.pdf',
    },
    {
        'slug': 'bandeiras-para-manifestacoes-30-x-45-cm',
        'title': 'Bandeiras para Manifestacoes 30 x 45 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Bandeiras-Paus-30x45cm.pdf',
    },
    {
        'slug': 'bandeiras-para-manifestacoes-45-x-70-cm',
        'title': 'Bandeiras para Manifestacoes 45 x 70 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Bandeiras-Paus-45x70cm.pdf',
    },
    {
        'slug': 'bandeiras-para-manifestacoes-70-x-100-cm',
        'title': 'Bandeiras para Manifestacoes 70 x 100 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Bandeiras-Paus-70x100cm.pdf',
    },
    {
        'slug': 'bandeiras-para-manifestacoes-100-x-150-cm',
        'title': 'Bandeiras para Manifestacoes 100 x 150 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Bandeiras-Paus-100x150cm.pdf',
    },
    {
        # Same supplier rectangle geometry as the 100x150cm handheld flag model.
        'slug': 'bandeiras-para-despacho-150-x-100-cm',
        'title': 'Bandeiras para Despacho 150 x 100 cm Print Area',
        'source_slug': 'bandeiras-para-manifestacoes-100-x-150-cm',
    },
    {
        'slug': 'x-banner-80-x-180-cm',
        'title': 'X-Banner 80 x 180 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-X-Banner.pdf',
        'drawing_index': 102,
    },
    {
        'slug': 'roll-up-85-x-200-cm',
        'title': 'Roll-Up 85 x 200 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-Roll-up.pdf',
        'drawing_index': 5,
    },
    {
        'slug': 'photocall-286-x-217-cm',
        'title': 'Photocall 286 x 217 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-Photocall-300x230-PT.pdf',
        'drawing_index': 0,
    },
    {
        'slug': 'wall-banner-60-x-230-cm',
        'title': 'Wall Banner 60 x 230 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-WallBanner-S-60x230.pdf',
        'drawing_index': 166,
    },
    {
        'slug': 'wall-banner-90-x-230-cm',
        'title': 'Wall Banner 90 x 230 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-WallBanner-M-90x230.pdf',
        'drawing_index': 166,
    },
    {
        'slug': 'wall-banner-120-x-230-cm',
        'title': 'Wall Banner 120 x 230 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-WallBanner-L-120x230.pdf',
        'drawing_index': 167,
    },
    {
        'slug': 'wall-banner-150-x-230-cm',
        'title': 'Wall Banner 150 x 230 cm Print Area',
        'pdf_url': 'https://adivin.com/upload/products_templates/1/Modelo-WallBanner-XL-150x230.pdf',
        'drawing_index': 167,
    },
]


def ensure_svg_from_pdf(config):
    slug = config['slug']
    title = config['title']
    pdf_url = config['pdf_url']
    drawing_index = config.get('drawing_index')
    output_svg = OUTPUT_DIR / f'{slug}-print-area.svg'
    pdf_path = TMP_DIR / f'{slug}.pdf'

    print(f'Downloading {pdf_url} -> {pdf_path.name}')
    urlretrieve(pdf_url, pdf_path)

    command = [
        'python',
        str(EXTRACTOR),
        str(pdf_path),
        str(output_svg),
        '--title',
        title,
    ]
    if drawing_index is not None:
        command.extend(['--drawing-index', str(drawing_index)])

    subprocess.run(command, check=True)


def clone_svg(config):
    source_slug = config['source_slug']
    target_slug = config['slug']
    source_svg = OUTPUT_DIR / f'{source_slug}-print-area.svg'
    target_svg = OUTPUT_DIR / f'{target_slug}-print-area.svg'
    if not source_svg.exists():
        raise FileNotFoundError(f'Source SVG not found for clone: {source_svg}')

    target_svg.write_text(
        source_svg.read_text(encoding='utf-8').replace(
            'Bandeiras para Manifestacoes 100 x 150 cm Print Area',
            config['title']
        ),
        encoding='utf-8'
    )
    print(f'Cloned {source_svg.name} -> {target_svg.name}')


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    for config in PRODUCTS:
        if config.get('source_slug'):
            clone_svg(config)
            continue
        ensure_svg_from_pdf(config)

    shutil.rmtree(TMP_DIR, ignore_errors=True)
    print(f'Generated {len(PRODUCTS)} supplier SVG templates in {OUTPUT_DIR}')


if __name__ == '__main__':
    main()
