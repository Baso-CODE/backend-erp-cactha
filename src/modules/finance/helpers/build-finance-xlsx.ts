import ExcelJS from "exceljs";
import { Readable } from "node:stream";

interface BuildFinanceXlsxOptions {
  csv: string;
  sheetName: string;
  moneyColumns?: number[];
  dateColumns?: number[];
}

export async function buildFinanceXlsx({
  csv,
  sheetName,
  moneyColumns = [],
  dateColumns = [],
}: BuildFinanceXlsxOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ERP Catha";
  workbook.created = new Date();

  const source = Readable.from([csv]);
  const worksheet = await workbook.csv.read(source, {
    sheetName,
    map: (value: string) => value,
  });

  if (!worksheet) {
    throw new Error("Gagal membuat worksheet Excel.");
  }

  const lastColumn = worksheet.columnCount;
  const lastRow = worksheet.rowCount;

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = {
      name: "Arial",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 10,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17337C" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };
  });

  worksheet.columns.forEach((column, index) => {
    const header = String(worksheet.getCell(1, index + 1).value ?? "");
    column.width = Math.min(35, Math.max(16, header.length + 5));
  });

  for (let rowIndex = 2; rowIndex <= lastRow; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    row.height = 20;

    row.eachCell((cell, columnNumber) => {
      const value = String(cell.value ?? "");

      cell.font = {
        name: "Arial",
        size: 10,
      };
      cell.alignment = { vertical: "middle" };

      if (rowIndex % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4F7FC" },
        };
      }

      if (moneyColumns.includes(columnNumber)) {
        const numericValue = Number(value);

        if (
          value.trim() !== "" &&
          Number.isFinite(numericValue) &&
          Math.abs(numericValue) <= Number.MAX_SAFE_INTEGER
        ) {
          cell.value = numericValue;
          cell.numFmt = "#,##0.00;[Red](#,##0.00)";
          cell.alignment = {
            horizontal: "right",
            vertical: "middle",
          };
        } else {
          cell.value = value;
        }
      } else if (dateColumns.includes(columnNumber)) {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? new Date(`${value}T00:00:00.000Z`)
          : null;

        if (date && !Number.isNaN(date.getTime())) {
          cell.value = date;
          cell.numFmt = "dd mmm yyyy";
        } else {
          cell.value = value;
        }
      } else {
        cell.value = value;
      }
    });
  }

  if (lastColumn > 0 && lastRow > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: lastColumn },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
