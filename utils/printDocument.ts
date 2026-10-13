import { Platform } from 'react-native';
import * as Print from 'expo-print';

export function a4Html(html: string): string {
  const style = '<style>@page { size: A4; margin: 12mm; } th, td { overflow-wrap: anywhere; } tr, .row { break-inside: avoid; } thead { display: table-header-group; } .value { white-space: pre-line; }</style>';
  return html.includes('</head>') ? html.replace('</head>', style + '</head>') : style + html;
}

/** Print the report itself, once, rather than the current application page. */
export async function printDocument(html: string): Promise<void> {
  const documentHtml = a4Html(html);
  if (Platform.OS !== 'web') { await Print.printAsync({ html: documentHtml, width: 595, height: 842 }); return; }
  await new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'Print report';
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;';
    let started = false;
    const remove = () => frame.remove();
    const timeout = setTimeout(() => { if (!started) { remove(); reject(new Error('The print document did not load. Please try again.')); } }, 15000);
    frame.onload = () => {
      if (started) return;
      started = true;
      clearTimeout(timeout);
      try {
        const target = frame.contentWindow;
        if (!target) throw new Error('Print window unavailable');
        target.addEventListener('afterprint', remove, { once: true });
        target.focus();
        target.print();
        setTimeout(remove, 60000);
        resolve();
      } catch (error) { remove(); reject(error); }
    };
    frame.srcdoc = documentHtml;
    document.body.appendChild(frame);
  });
}
