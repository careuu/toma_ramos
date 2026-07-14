import pandas as pd

# Load the Excel file
file_path = "ING_CIVIL_INDUSTRIAL.xls"
xls = pd.ExcelFile(file_path)

print("Sheet names:")
print(xls.sheet_names)

# Display info about each sheet
for sheet_name in xls.sheet_names:
    print(f"\n--- Sheet: {sheet_name} ---")
    df = pd.read_excel(file_path, sheet_name=sheet_name)
    print("Columns:")
    print(df.columns.tolist())
    print("Shape:", df.shape)
    print("First 5 rows:")
    print(df.head(5).to_string())
