# Plantilla de Excel del menú (EN y ES). Uso: python scripts/plantilla-menu.py assets/files  (necesita openpyxl)
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

T = {
  'es': dict(file='plantilla-menu.xlsx', sheet='Menú', title='Tu menú para menutab',
    note='Una fila por plato. Si un plato tiene tamaños (p. ej. pequeño/grande), escribe un tamaño y su precio en cada par de columnas. Las fotos de los platos súbelas aparte en «Mi pedido», con el nombre del plato si puedes.',
    cols=['Categoría', 'Plato', 'Descripción (español)', 'Descripción (inglés, opcional)', 'Tamaño 1', 'Precio 1', 'Tamaño 2', 'Precio 2', 'Tamaño 3', 'Precio 3', '¿Picante?', '¿Vegetariano?', 'Notas'],
    yes='Sí', no='No',
    ex=[['Entradas', 'Empanadas de carne', 'Tres empanadas crujientes con ají de la casa', 'Three crispy beef empanadas with house hot sauce', '', 6.5, '', '', '', '', 'No', 'No', ''],
        ['Platos fuertes', 'Bandeja paisa', 'Frijoles, arroz, chicharrón, carne molida, huevo, maduro y arepa', 'Beans, rice, pork belly, ground beef, egg, plantain and arepa', 'Normal', 18.99, 'Grande', 23.99, '', '', 'No', 'No', 'El plato estrella'],
        ['Bebidas', 'Jugo natural', 'Mango, mora, lulo o maracuyá', 'Mango, blackberry, lulo or passion fruit', 'En agua', 4.5, 'En leche', 5.5, '', '', 'No', 'Sí', '']]),
  'en': dict(file='menu-template.xlsx', sheet='Menu', title='Your menu for menutab',
    note='One row per dish. If a dish comes in sizes (e.g. small/large), write one size and its price in each pair of columns. Upload the photos of your dishes separately in «My order», named after the dish if you can.',
    cols=['Category', 'Dish', 'Description (English)', 'Description (Spanish, optional)', 'Size 1', 'Price 1', 'Size 2', 'Price 2', 'Size 3', 'Price 3', 'Spicy?', 'Vegetarian?', 'Notes'],
    yes='Yes', no='No',
    ex=[['Starters', 'Beef empanadas', 'Three crispy beef empanadas with house hot sauce', 'Tres empanadas crujientes con ají de la casa', '', 6.5, '', '', '', '', 'No', 'No', ''],
        ['Mains', 'Bandeja paisa', 'Beans, rice, pork belly, ground beef, egg, plantain and arepa', 'Frijoles, arroz, chicharrón, carne molida, huevo, maduro y arepa', 'Regular', 18.99, 'Large', 23.99, '', '', 'No', 'No', 'Our best seller'],
        ['Drinks', 'Fresh juice', 'Mango, blackberry, lulo or passion fruit', 'Mango, mora, lulo o maracuyá', 'Water-based', 4.5, 'Milk-based', 5.5, '', '', 'No', 'Yes', '']]),
}
NIGHT, GUAVA, PAPER = '14121A', 'C8324D', 'FBF3E7'
for lang, t in T.items():
    wb = Workbook(); ws = wb.active; ws.title = t['sheet']
    ws['A1'] = t['title']; ws['A1'].font = Font(bold=True, size=16, color=NIGHT)
    ws['A2'] = t['note']; ws['A2'].font = Font(italic=True, size=10, color='5F5868'); ws['A2'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(t['cols'])); ws.row_dimensions[2].height = 32
    thin = Border(bottom=Side(style='thin', color='E7E1D8'))
    for c, name in enumerate(t['cols'], 1):
        cell = ws.cell(row=4, column=c, value=name)
        cell.font = Font(bold=True, color='FFFFFF'); cell.fill = PatternFill('solid', fgColor=NIGHT if c > 2 else GUAVA)
        cell.alignment = Alignment(vertical='center', wrap_text=True)
    ws.row_dimensions[4].height = 30
    for r, row in enumerate(t['ex'], 5):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=v if v != '' else None)
            cell.fill = PatternFill('solid', fgColor=PAPER); cell.font = Font(color='5F5868', italic=True)
            cell.alignment = Alignment(wrap_text=True, vertical='top')
    for r in range(5, 205):
        for c in (6, 8, 10): ws.cell(row=r, column=c).number_format = '"$"#,##0.00'
        for c in range(1, len(t['cols']) + 1): ws.cell(row=r, column=c).border = thin
    dv = DataValidation(type='list', formula1=f'"{t["yes"]},{t["no"]}"', allow_blank=True); ws.add_data_validation(dv); dv.add('K5:L204')
    for col, w in zip('ABCDEFGHIJKLM', [16, 24, 42, 36, 12, 10, 12, 10, 12, 10, 11, 13, 24]): ws.column_dimensions[col].width = w
    ws.freeze_panes = 'C5'
    wb.save(sys.argv[1] + '/' + t['file'])
    print('ok', t['file'])
