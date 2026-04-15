import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FanSchedule } from '../types';

export async function generateExcel(schedule: FanSchedule) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FanSched App';
  
  schedule.tabs.forEach((tab) => {
    const sheetName = tab.typeName.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    // 1. Define Columns first to set widths and keys
    const columns = [
      { header: 'TAG', key: 'tag', width: 15 },
      { header: 'TYPE', key: 'type', width: 25 },
      { header: 'MANUFACTURER', key: 'manufacturer', width: 25 },
      { header: 'MODEL', key: 'model', width: 25 },
      { header: 'CFM', key: 'cfm', width: 12 },
      { header: 'ESP', key: 'esp', width: 12 },
      { header: 'DRIVE', key: 'driveType', width: 12 },
      { header: 'RPM', key: 'rpm', width: 10 },
      { header: 'HP', key: 'hp', width: 10 },
      { header: 'VOLT/PH', key: 'voltage_phase', width: 15 },
      { header: 'REMARKS', key: 'notes', width: 50 },
    ];

    // Add Metric columns if needed
    const hasMetric = tab.groups.some(g => g.fans.some(f => f.metricCfm || f.metricEsp));
    if (hasMetric) {
      columns.splice(6, 0, 
        { header: 'L/S', key: 'metricCfm', width: 12 },
        { header: 'Pa', key: 'metricEsp', width: 12 }
      );
    }

    worksheet.columns = columns;

    // 2. Clear the auto-generated header row (row 1) to make room for our custom title
    worksheet.getRow(1).values = [];

    // 3. Add Title and Info
    const titleRow = worksheet.getRow(1);
    titleRow.values = [tab.typeName.toUpperCase()];
    titleRow.font = { bold: true, size: 20, name: 'Arial' };
    titleRow.height = 35;
    titleRow.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(1, 1, 1, columns.length);

    const subTitleRow = worksheet.addRow(['MECHANICAL EQUIPMENT SCHEDULE - FAN DATA']);
    subTitleRow.font = { italic: true, size: 12, color: { argb: 'FF444444' } };
    subTitleRow.height = 25;
    subTitleRow.alignment = { vertical: 'middle' };
    worksheet.mergeCells(subTitleRow.number, 1, subTitleRow.number, columns.length);

    worksheet.addRow([]); // Spacer

    // 4. Add Spec Notes
    if (tab.specNotes && tab.specNotes.length > 0) {
      const notesHeader = worksheet.addRow(['SPECIFICATION NOTES:']);
      notesHeader.font = { bold: true, size: 11 };
      
      tab.specNotes.forEach((note, index) => {
        const row = worksheet.addRow([`${index + 1}. ${note}`]);
        row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
        row.height = 30; // Give space for wrapping
        worksheet.mergeCells(row.number, 1, row.number, columns.length);
      });
      worksheet.addRow([]); // Spacer
    }

    // 5. Add Table Header
    const headerRow = worksheet.addRow(columns.map(c => c.header));
    headerRow.height = 35;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Segoe UI' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Deep Slate Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.border = {
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };

    // 6. Add Data Groups
    tab.groups.forEach((group) => {
      // Group Header
      const groupRow = worksheet.addRow([`GROUP: ${group.cfm} CFM @ ${group.esp} in.WG`]);
      groupRow.height = 28;
      groupRow.font = { bold: true, size: 10, color: { argb: 'FF334155' }, name: 'Segoe UI' };
      groupRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' } // Light Slate
      };
      groupRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      worksheet.mergeCells(groupRow.number, 1, groupRow.number, columns.length);
      groupRow.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // Fans
      group.fans.forEach((fan, index) => {
        const rowData = {
          tag: fan.tag,
          type: fan.type,
          manufacturer: fan.manufacturer || '-',
          model: fan.model || '-',
          cfm: fan.cfm,
          esp: fan.esp,
          driveType: fan.driveType || '-',
          rpm: fan.rpm || '-',
          hp: fan.hp || '-',
          voltage_phase: `${fan.voltage || '-'}/${fan.phase || '-'}`,
          notes: fan.notes || '-',
          metricCfm: fan.metricCfm,
          metricEsp: fan.metricEsp
        };
        
        const row = worksheet.addRow(rowData);
        row.height = 24;
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        row.font = { name: 'Segoe UI', size: 10 };
        
        // Zebra striping
        if (index % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }
        
        // Specific alignments
        row.getCell('tag').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        row.getCell('tag').font = { bold: true, color: { argb: 'FF0F172A' }, name: 'Segoe UI' };
        row.getCell('type').alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell('manufacturer').alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell('model').alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell('notes').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        row.getCell('notes').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

        // Borders
        row.eachCell((cell) => {
          cell.border = {
            left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } },
            bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };
        });
      });
    });

    // 7. Final Touches
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow.number }];
    
    // Auto-filter on the data range
    worksheet.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: worksheet.rowCount, column: columns.length }
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Fan_Schedule_${new Date().toISOString().split('T')[0]}.xlsx`);
}
