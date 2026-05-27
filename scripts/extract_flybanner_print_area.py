import argparse
import math
from pathlib import Path

import fitz


SVG_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'


def parse_args():
    parser = argparse.ArgumentParser(
        description='Extract the largest red print-area outline from a supplier PDF into an SVG.'
    )
    parser.add_argument('input_pdf', help='Path to the source PDF file.')
    parser.add_argument('output_svg', help='Path to write the extracted SVG file.')
    parser.add_argument('--page', type=int, default=0, help='Zero-based PDF page index. Default: 0')
    parser.add_argument(
        '--drawing-index',
        type=int,
        default=None,
        help='Optional explicit drawing index. When omitted, the largest red stroke is auto-selected.'
    )
    parser.add_argument(
        '--title',
        default='Fly Banner Print Area',
        help='Accessible title stored inside the exported SVG.'
    )
    return parser.parse_args()


def is_red_stroke(drawing):
    color = drawing.get('color')
    if not color or len(color) < 3:
        return False

    red, green, blue = color[:3]
    return red >= 0.7 and green <= 0.35 and blue <= 0.35


def drawing_area(drawing):
    rect = drawing.get('rect')
    if not rect:
        return 0
    return max(0, rect.width) * max(0, rect.height)


def format_number(value):
    rounded = round(float(value), 3)
    if math.isclose(rounded, round(rounded), abs_tol=1e-9):
        return str(int(round(rounded)))
    return f'{rounded:.3f}'.rstrip('0').rstrip('.')


def path_data_from_items(items, close_path=False):
    commands = []
    current_point = None

    def move_to(point):
        return f'M {format_number(point.x)} {format_number(point.y)}'

    for item in items:
        op = item[0]

        if op == 'l':
            start, end = item[1], item[2]
            if current_point is None or not points_match(current_point, start):
                commands.append(move_to(start))
            commands.append(f'L {format_number(end.x)} {format_number(end.y)}')
            current_point = end
        elif op == 'c':
            start, c1, c2, end = item[1], item[2], item[3], item[4]
            if current_point is None or not points_match(current_point, start):
                commands.append(move_to(start))
            commands.append(
                'C '
                f'{format_number(c1.x)} {format_number(c1.y)} '
                f'{format_number(c2.x)} {format_number(c2.y)} '
                f'{format_number(end.x)} {format_number(end.y)}'
            )
            current_point = end
        elif op == 're':
            rect = item[1]
            commands.append(
                'M '
                f'{format_number(rect.x0)} {format_number(rect.y0)} '
                f'L {format_number(rect.x1)} {format_number(rect.y0)} '
                f'L {format_number(rect.x1)} {format_number(rect.y1)} '
                f'L {format_number(rect.x0)} {format_number(rect.y1)} Z'
            )
            current_point = fitz.Point(rect.x0, rect.y0)
        elif op == 'qu':
            start, control, end = item[1], item[2], item[3]
            if current_point is None or not points_match(current_point, start):
                commands.append(move_to(start))
            commands.append(
                'Q '
                f'{format_number(control.x)} {format_number(control.y)} '
                f'{format_number(end.x)} {format_number(end.y)}'
            )
            current_point = end
        else:
            raise ValueError(f'Unsupported PDF drawing operation: {op}')

    if close_path:
        commands.append('Z')

    return ' '.join(commands)


def points_match(a, b, tolerance=0.01):
    return (
        abs(float(a.x) - float(b.x)) <= tolerance
        and abs(float(a.y) - float(b.y)) <= tolerance
    )


def build_svg_markup(path_data, rect, title):
    width = max(1.0, float(rect.width))
    height = max(1.0, float(rect.height))
    translate_x = -float(rect.x0)
    translate_y = -float(rect.y0)

    svg = [
        SVG_HEADER,
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {format_number(width)} {format_number(height)}" '
            f'width="{format_number(width)}" height="{format_number(height)}" '
            f'data-template-bounds="0 0 {format_number(width)} {format_number(height)}" '
            f'preserveAspectRatio="xMidYMid meet">'
        ),
        f'<title>{escape_xml(title)}</title>',
        (
            '<path '
            'id="print-area-shape" '
            'data-personalizable-outline="true" '
            f'd="{path_data}" '
            f'transform="translate({format_number(translate_x)} {format_number(translate_y)})" '
            'fill="none" '
            'stroke="#ef4444" '
            'stroke-width="1" '
            'vector-effect="non-scaling-stroke" />'
        ),
        '</svg>\n'
    ]
    return '\n'.join(svg)


def escape_xml(value):
    return (
        str(value)
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&apos;')
    )


def select_drawing(drawings, requested_index=None):
    if requested_index is not None:
        if requested_index < 0 or requested_index >= len(drawings):
            raise IndexError(f'Drawing index {requested_index} is outside the available range 0..{len(drawings) - 1}.')
        return requested_index, drawings[requested_index]

    candidates = [
        (index, drawing)
        for index, drawing in enumerate(drawings)
        if drawing.get('type') == 's' and is_red_stroke(drawing)
    ]
    if not candidates:
        raise RuntimeError('No red stroke drawings were found in the PDF.')

    return max(candidates, key=lambda item: drawing_area(item[1]))


def main():
    args = parse_args()
    input_pdf = Path(args.input_pdf)
    output_svg = Path(args.output_svg)

    if not input_pdf.exists():
        raise FileNotFoundError(f'PDF file not found: {input_pdf}')

    document = fitz.open(input_pdf)
    if args.page < 0 or args.page >= len(document):
        raise IndexError(f'Page {args.page} is outside the available range 0..{len(document) - 1}.')

    page = document[args.page]
    drawings = page.get_drawings()
    drawing_index, drawing = select_drawing(drawings, args.drawing_index)
    path_data = path_data_from_items(drawing.get('items', []), close_path=bool(drawing.get('closePath')))
    rect = drawing.get('rect')

    if not rect:
        raise RuntimeError(f'Drawing {drawing_index} does not have a valid bounding rectangle.')

    svg_markup = build_svg_markup(path_data, rect, args.title)
    output_svg.parent.mkdir(parents=True, exist_ok=True)
    output_svg.write_text(svg_markup, encoding='utf-8')

    print(f'Extracted drawing {drawing_index} from {input_pdf.name} -> {output_svg}')
    print(f'Bounds: {format_number(rect.x0)}, {format_number(rect.y0)}, {format_number(rect.width)}, {format_number(rect.height)}')


if __name__ == '__main__':
    main()
