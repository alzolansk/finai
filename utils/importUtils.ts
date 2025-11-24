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
    const lower = description.toLowerCase().trim();
    const patterns = [
        'pagamento fatura',
        'pgto fatura',
        'pagamento de fatura',
        'pagto cartão',
        'pagamento cartao',
        'debito automatico fatura',
        'débito automático fatura',
        'pag fatura',
        'fatura cartão',
        'fatura cartao',
        'quitação fatura',
        'quitacao fatura'
    ];
    return patterns.some(pattern => lower.includes(pattern));
};

export const isLikelyInternalTransfer = (description: string, ownerName?: string): boolean => {
    const lower = description.toLowerCase().trim();
    
    // Generic internal transfer patterns
    const internalPatterns = [
        'transferência entre contas',
        'transferencia entre contas',
        'resgate',
        'aplicação',
        'aplicacao',
        'saldo anterior',
        'transferência própria',
        'transferencia propria',
        'poupança',
        'poupanca',
        'investimento próprio',
        'investimento proprio'
    ];
    
    if (internalPatterns.some(pattern => lower.includes(pattern))) {
        return true;
    }
    
    // Check if both origin and destination mention the same owner
    if (ownerName && lower.includes(ownerName.toLowerCase())) {
        const transferKeywords = ['transferência', 'transferencia', 'pix', 'ted', 'doc'];
        if (transferKeywords.some(keyword => lower.includes(keyword))) {
            // Count how many times the owner name appears
            const regex = new RegExp(ownerName.toLowerCase(), 'g');
            const matches = lower.match(regex);
            // If owner name appears 2+ times in a transfer description, it's likely internal
            if (matches && matches.length >= 2) {
                return true;
            }
        }
    }
    
    return false;
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
