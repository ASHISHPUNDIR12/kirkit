import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { EncodingType, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { MatchDetails } from '../types/api';
import { scorecardHtml } from './scorecardHtml';
import { downloadScorecardPdfWeb } from './scorecardWebPdf';
import { runNativePdfWorkflow } from './nativePdfWorkflow';

function safeFilePart(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'match';
}

export async function exportScorecardPdf(match: MatchDetails): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      // expo-print's web implementation calls window.print(), and expo-file-system
      // is a native-only stub on web. Build actual PDF bytes and download them.
      return downloadScorecardPdfWeb(match);
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const filename = `${safeFilePart(match.team1Name)}_vs_${safeFilePart(match.team2Name)}_Scorecard_${timestamp}_${Date.now()}.pdf`;
    return await runNativePdfWorkflow(scorecardHtml(match), filename, {
      print: html => Print.printToFileAsync({ html, base64: true }),
      persist: async (base64, name) => {
        const file = new File(Paths.cache, 'scorecards', name);
        file.create({ intermediates: true });
        file.write(base64, { encoding: EncodingType.Base64 });
        return file.uri;
      },
      canShare: () => Sharing.isAvailableAsync(),
      share: uri => Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share scorecard PDF' }),
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[scorecard-pdf] export failed on ${Platform.OS}: ${detail}`);
    throw error;
  }
}
