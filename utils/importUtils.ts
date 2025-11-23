import * as XLSX from 'xlsx';
import { TransactionType, Category, TransacaoNormalizada, TipoImportacao } from '../types';

export const detectarTipoImportacao = (file: { name: string; type: string }): TipoImportacao => {
    const { name, type } = file;
    if (type === 'application/pdf') return 'pdf';
    if (type.startsWith('image/')) return 'imagem';
    if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('spreadsheet') || type.includes('excel')) return 'planilha';
    return 'desconhecido';
};

export const isPagamentoFaturaDescription = (description: string): boolean => {
    const lower = description.toLowerCase();
    return lower.includes('pagamento fatura') || lower.includes('pgto fatura') || lower.includes('pagamento de fatura');
};

export const isLikelyInternalTransfer = (description: string): boolean => {
    const lower = description.toLowerCase();
    return lower.includes('transferência') || lower.includes('resgate') || lower.includes('aplicação') || lower.includes('saldo anterior');
};

export const normalizarTransacaoGenerica = (raw: any): TransacaoNormalizada => {
    return {
        date: raw.date || new Date().toISOString(),
        description: raw.description || 'Sem descrição',
        amount: Number(raw.amount) || 0,
        type: raw.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
        category: Category.OTHER,
        paymentDate: raw.paymentDate || raw.date,
        isRecurring: false
    };
};

export const parseSpreadsheet = (fileData: string, mimeType: string, fileName: string): TransacaoNormalizada[] => {
    try {
        const workbook = XLSX.read(fileData, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        return jsonData.map((row: any) => {
            // Simple heuristic mapping
            const amount = row['Valor'] || row['Amount'] || row['valor'] || row['amount'] || 0;
            const description = row['Descrição'] || row['Description'] || row['descrição'] || row['description'] || 'Item Importado';
            let date = row['Data'] || row['Date'] || row['data'] || row['date'];
            
            // Handle Excel serial dates if necessary, but for now assume string or standard format
            if (typeof date === 'number') {
                // Excel date serial conversion if needed
                date = new Date(Math.round((date - 25569)*86400*1000)).toISOString();
            } else if (!date) {
                date = new Date().toISOString();
            } else {
                try {
                    date = new Date(date).toISOString();
                } catch (e) {
                    date = new Date().toISOString();
                }
            }

            return {
                date: date,
                description: String(description),
                amount: Math.abs(Number(amount)),
                type: Number(amount) < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
                category: Category.OTHER,
                paymentDate: date,
                isRecurring: false
            };
        });
    } catch (error) {
        console.error("Error parsing spreadsheet:", error);
        return [];
    }
};
