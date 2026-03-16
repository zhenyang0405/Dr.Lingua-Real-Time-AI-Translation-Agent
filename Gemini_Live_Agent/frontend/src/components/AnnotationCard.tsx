import React from 'react';
import ReactMarkdown from 'react-markdown';
import { TranslationDoc } from '../types/messages';

interface Props {
  doc: TranslationDoc;
}

export const AnnotationCard: React.FC<Props> = ({ doc }) => {
  const timeStr = doc.timestamp?.toDate
    ? doc.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  if (!doc) return null;

  return (
    <div className="bg-white rounded shadow-sm border border-gray-200 mb-4 p-4 overflow-hidden">
      <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span>{(doc.image_url || doc.gcs_path) ? '🖼️' : '📄'}</span> {doc.section_id || 'Translation'}
        </h3>
        <span className="text-xs text-gray-400">{timeStr}</span>
      </div>

      {doc.image_url && (
        <div className="mb-3">
          <img
            src={doc.image_url}
            alt={doc.image_description || 'Translated image'}
            className="w-full rounded border border-gray-200 cursor-pointer"
            onClick={() => window.open(doc.image_url, '_blank')}
            loading="lazy"
          />
          {doc.image_description && (
            <p className="text-xs text-gray-500 mt-1 italic">{doc.image_description}</p>
          )}
        </div>
      )}

      {doc.source_text && (
        <div className="mb-3 text-sm text-gray-500 italic overflow-x-auto">
          <ReactMarkdown>
            {doc.source_text}
          </ReactMarkdown>
        </div>
      )}

      {doc.translated_text && (
        <div className="mb-4 text-[15px] leading-relaxed text-gray-900 overflow-x-auto whitespace-pre-wrap break-words">
          <ReactMarkdown>
            {doc.translated_text}
          </ReactMarkdown>
        </div>
      )}
      
      {!doc.translated_text && !doc.source_text && !doc.image_url && !doc.gcs_path && (
        <p className="text-gray-400 italic text-sm">Empty translation content</p>
      )}

      {doc.nuance_notes && (
        <div className="bg-blue-50/50 rounded p-3 mb-3 border border-blue-100">
          <p className="text-sm text-blue-800 italic">
            <span className="font-medium not-italic">📝 Nuance:</span> {doc.nuance_notes}
          </p>
        </div>
      )}
    </div>
  );
};
