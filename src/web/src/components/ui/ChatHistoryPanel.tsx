'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';
import { QuestionGroup } from '@/types';

function exportQuestionAsManuscript(group: QuestionGroup) {
  if (typeof window === 'undefined') return;

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const formattedDate = new Date(group.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = new Date(group.timestamp).toLocaleTimeString();

  const entriesHtml = group.responses
    .map((msg) => {
      const isUser = msg.senderId === 'user';
      const senderColor =
        msg.senderId === 'marx'
          ? '#8B1E2B'
          : msg.senderId === 'bakunin'
          ? '#38302B'
          : msg.senderId === 'mill'
          ? '#A0751A'
          : '#2B4C6F';

      return `
        <div class="discourse-entry ${isUser ? 'entry-user' : 'entry-philosopher'}">
          <div class="entry-header">
            <span class="author-name" style="color: ${senderColor}">
              ${isUser ? `◆ ${escapeHtml(msg.senderName)}` : `§ ${escapeHtml(msg.senderName)}`}
            </span>
            <span class="entry-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="entry-text">${escapeHtml(msg.text)}</div>
        </div>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Roundtable Manuscript — ${escapeHtml(group.questionText.slice(0, 48))}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800;900&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    
    @page {
      size: A4;
      margin: 18mm;
    }
    
    * {
      box-sizing: border-box;
    }

    body {
      background-color: #F8F3E8;
      color: #2B1B0E;
      font-family: 'Playfair Display', Georgia, serif;
      margin: 0;
      padding: 32px 16px;
      line-height: 1.7;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .manuscript {
      max-width: 740px;
      margin: 0 auto;
      background: #FDFBF7;
      border: 2px solid #8C6D46;
      padding: 44px 52px;
      box-shadow: 0 6px 28px rgba(60, 40, 20, 0.12);
      position: relative;
    }

    .manuscript::before {
      content: '';
      position: absolute;
      top: 6px; left: 6px; right: 6px; bottom: 6px;
      border: 1px solid rgba(140, 109, 70, 0.35);
      pointer-events: none;
    }

    .manuscript-header {
      text-align: center;
      border-bottom: 2px solid #8C6D46;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }

    .manuscript-crest {
      font-size: 26px;
      color: #8C6D46;
      margin-bottom: 4px;
    }

    .manuscript-title {
      font-family: 'Cinzel', serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #4A1D24;
      margin: 0 0 6px 0;
    }

    .manuscript-subtitle {
      font-family: 'Cinzel', serif;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #7D5E3C;
      margin: 0 0 10px 0;
    }

    .manuscript-date {
      font-size: 12px;
      color: #8C6D46;
      font-style: italic;
    }

    .question-section {
      background: #F5EEDB;
      border-left: 4px solid #501A1E;
      padding: 16px 22px;
      margin-bottom: 32px;
      border-radius: 2px;
    }

    .question-tag {
      font-family: 'Cinzel', serif;
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #6E4F32;
      margin-bottom: 6px;
      font-weight: 700;
    }

    .question-body {
      font-size: 17px;
      font-weight: 700;
      color: #201308;
      margin: 0;
      line-height: 1.5;
    }

    .section-divider {
      text-align: center;
      font-family: 'Cinzel', serif;
      font-size: 11px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #8C6D46;
      margin: 28px 0 20px 0;
    }

    .discourse-entry {
      margin-bottom: 22px;
      padding-bottom: 18px;
      border-bottom: 1px dashed #D8C7AA;
    }

    .discourse-entry:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .author-name {
      font-family: 'Cinzel', serif;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.06em;
    }

    .entry-time {
      font-size: 11px;
      color: #8C6D46;
      font-style: italic;
    }

    .entry-text {
      font-size: 15px;
      color: #332215;
      line-height: 1.68;
    }

    .entry-user {
      background: #FAF4E8;
      padding: 12px 16px;
      border-left: 3px solid #2B4C6F;
      border-radius: 2px;
    }

    .manuscript-footer {
      text-align: center;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #8C6D46;
      font-size: 11px;
      color: #7D5E3C;
      font-style: italic;
      letter-spacing: 0.05em;
    }

    @media print {
      body {
        background: none;
        padding: 0;
      }
      .manuscript {
        border: 2px solid #8C6D46;
        box-shadow: none;
        padding: 24px;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="manuscript">
    <div class="manuscript-header">
      <div class="manuscript-crest">⚜</div>
      <h1 class="manuscript-title">Philosophical Roundtable</h1>
      <div class="manuscript-subtitle">Discourse Transcript & Proceedings</div>
      <div class="manuscript-date">Convened on ${formattedDate} at ${formattedTime}</div>
    </div>

    <div class="question-section">
      <div class="question-tag">The Central Inquiry</div>
      <div class="question-body">"${escapeHtml(group.questionText)}"</div>
    </div>

    <div class="section-divider">— Colloquy & Disputation —</div>

    <div class="discourse-list">
      ${entriesHtml}
    </div>

    <div class="manuscript-footer">
      Recorded from the Dialectical Roundtable • Historical Proceedings
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  }
}

export default function ChatHistoryPanel() {
  const {
    questionGroups,
    isHistoryPanelOpen,
    setHistoryPanelOpen,
    expandedQuestionId,
    setExpandedQuestionId,
  } = useChatStore();

  const getCharacterAccent = (senderId: string) => {
    if (senderId === 'user') return '#2B4C6F'; // vintage manuscript navy
    if (senderId === 'marx') return '#8B1E2B'; // antique seal red
    if (senderId === 'bakunin') return '#38302B'; // antique lamp-black / charcoal
    if (senderId === 'mill') return '#A0751A'; // antique ochre gold
    return '#8C6D46'; // antique sepia
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestionId(expandedQuestionId === questionId ? null : questionId);
  };

  return (
    <>
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        animate={{
          opacity: isHistoryPanelOpen ? 0 : 1,
          scale: isHistoryPanelOpen ? 0.9 : 1,
          pointerEvents: isHistoryPanelOpen ? 'none' : 'auto',
        }}
        transition={{ duration: 0.2 }}
        onClick={() => setHistoryPanelOpen(true)}
        className="fixed bottom-4 left-4 z-40 px-4 py-2 rounded-[4px_6px_5px_4px] parchment-surface border border-[#8C6D46]/60 text-[#2B1B0E] font-parchment font-semibold text-sm hover:border-[#8C6D46] shadow-[0_4px_16px_rgba(45,28,14,0.35)]"
      >
        History
      </motion.button>

      {/* History panel drawer */}
      <motion.div
        initial={false}
        animate={{ x: isHistoryPanelOpen ? 0 : -384 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 h-full w-96 z-40 parchment-surface border-r border-[#8C6D46]/50 flex flex-col shadow-[8px_0_30px_rgba(30,18,8,0.5)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#8C6D46]/30">
          <h2 className="text-lg font-parchment font-semibold text-[#2B1B0E]">
            Conversation History
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setHistoryPanelOpen(false)}
            className="text-[#6E4F32] hover:text-[#2B1B0E] p-1.5 rounded-md hover:bg-[#8C6D46]/10 transition-colors"
            aria-label="Close conversation history"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </div>

        {/* Question groups */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {questionGroups.length === 0 ? (
            <p className="text-[#7D6650] font-parchment italic text-center mt-8">
              No messages recorded yet
            </p>
          ) : (
            questionGroups.map((group) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                className="bg-[#F7EED9]/85 border border-[#8C6D46]/40 hover:border-[#8C6D46]/70 rounded-[4px_6px_5px_4px] overflow-hidden transition-colors shadow-sm"
              >
                {/* Question header (always visible) */}
                <motion.button
                  onClick={() => toggleQuestion(group.id)}
                  whileHover={{ backgroundColor: 'rgba(140, 109, 70, 0.08)' }}
                  whileTap={{ scale: 0.995 }}
                  className="w-full text-left p-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#2B1B0E] font-parchment text-sm font-semibold line-clamp-2 leading-snug">
                        {group.questionText}
                      </p>
                      <p className="text-xs font-parchment text-[#7D6650] mt-1 flex items-center gap-1.5">
                        <span>{new Date(group.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>
                          {group.responses.length} {group.responses.length === 1 ? 'dispatch' : 'dispatches'}
                        </span>
                      </p>
                    </div>
                    <motion.svg
                      animate={{ rotate: expandedQuestionId === group.id ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="w-4 h-4 text-[#6E4F32] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </div>
                </motion.button>

                {/* Expanded responses with staggered entrance */}
                <AnimatePresence initial={false}>
                  {expandedQuestionId === group.id && (
                    <motion.div
                      key="responses"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }}
                      className="overflow-hidden border-t border-[#8C6D46]/30 bg-[#EFE3C5]/40"
                    >
                      {/* Subheader with dispatch count & export manuscript button */}
                      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[#8C6D46]/20 bg-[#F4ECD8]/90">
                        <span className="text-[11px] font-parchment font-semibold text-[#6E4F32]">
                          {group.responses.length} {group.responses.length === 1 ? 'Dispatch' : 'Dispatches'}
                        </span>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            exportQuestionAsManuscript(group);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-parchment font-bold text-[#541E24] bg-[#EFE3C5] hover:bg-[#E4D5B3] border border-[#8C6D46]/50 rounded-[3px] cursor-pointer shadow-xs transition-colors"
                          title="Print or save as antique manuscript PDF"
                          aria-label="Export conversation manuscript"
                        >
                          <span aria-hidden="true" className="text-xs">🪶</span>
                          <span>Export Letter</span>
                        </motion.button>
                      </div>

                      <motion.div
                        variants={{
                          hidden: {},
                          visible: {
                            transition: {
                              staggerChildren: 0.07,
                              delayChildren: 0.03,
                            },
                          },
                        }}
                        initial="hidden"
                        animate="visible"
                        className="py-2"
                      >
                        {group.responses.map((msg) => (
                          <motion.div
                            key={msg.id}
                            variants={{
                              hidden: { opacity: 0, y: 8, scale: 0.97 },
                              visible: {
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                transition: { type: 'spring', stiffness: 360, damping: 26 },
                              },
                            }}
                            className={`
                              p-3 mx-3 my-1.5 rounded-r-lg rounded-l-none shadow-sm
                              ${msg.senderId === 'user'
                                ? 'ml-4 bg-[#EADCC0] border-l-4'
                                : 'mr-4 bg-[#FBF5E8] border-l-4'
                              }
                            `}
                            style={{
                              borderLeftColor: getCharacterAccent(msg.senderId),
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-parchment font-bold text-[#2B1B0E]">
                                {msg.senderName}
                              </span>
                              <span className="text-xs font-parchment text-[#7D6650]">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-[#352317] font-parchment text-sm leading-relaxed">
                              {msg.text}
                            </p>
                          </motion.div>
                        ))}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>

        {/* Close button at bottom */}
        <div className="p-4 border-t border-[#8C6D46]/30">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setHistoryPanelOpen(false)}
            className="w-full py-2 bg-[#541E24] hover:bg-[#68232B] active:bg-[#43161B] text-[#F7EED9] border border-[#3D1418] rounded-[4px_6px_5px_4px] font-parchment font-semibold text-sm shadow-sm transition-colors"
          >
            Close History
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}


