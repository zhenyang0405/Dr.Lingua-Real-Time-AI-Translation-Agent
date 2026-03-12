import React from 'react';
import { AnnotationItem, DisplayTranslationArgs, TranslateImageRegionArgs } from '../types/messages';

interface Props {
  item: AnnotationItem;
}

export const AnnotationCard: React.FC<Props> = ({ item }) => {
  const isImageTx = item.type === "image_translation";
  const date = new Date(item.timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isImageTx) {
    const args = item.args as TranslateImageRegionArgs;
    return (
      <div className="bg-white rounded shadow-sm border border-gray-200 mb-4 p-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>🖼️</span> {args.image_description}
          </h3>
          <span className="text-xs text-gray-400">{timeStr}</span>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Translated Labels:</h4>
          <ul className="space-y-2">
            {args.translated_labels?.map((label, idx) => (
              <li key={idx} className="text-sm">
                <span className="font-medium text-blue-700">{label.original}</span>
                <span className="text-gray-500 mx-2">→</span>
                <span className="font-medium text-gray-900">{label.translated}</span>
                {label.position && (
                  <span className="text-xs text-gray-400 ml-2">({label.position})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Text Translation
  const args = item.args as DisplayTranslationArgs;
  return (
    <div className="bg-white rounded shadow-sm border border-gray-200 mb-4 p-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span>📄</span> {args.section_id}
        </h3>
        <span className="text-xs text-gray-400">{timeStr}</span>
      </div>
      
      <div className="mb-4">
        <p className="text-gray-900 text-[15px] leading-relaxed">
          {args.translated_text}
        </p>
      </div>

      {args.nuance_notes && (
        <div className="bg-blue-50/50 rounded p-3 mb-3 border border-blue-100">
          <p className="text-sm text-blue-800 italic">
            <span className="font-medium not-italic">📝 Nuance:</span> {args.nuance_notes}
          </p>
        </div>
      )}

      {args.key_terms && args.key_terms.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Terms</h4>
          <ul className="space-y-1">
            {args.key_terms.map((term, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-gray-400 mt-[2px]">•</span>
                <div>
                   <span className="font-medium text-gray-700">{term.original}</span>
                   <span className="text-gray-400 mx-1">→</span>
                   <span className="font-medium text-gray-900">{term.translated}</span>
                   {term.context && <span className="text-xs text-gray-500 block">{term.context}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
