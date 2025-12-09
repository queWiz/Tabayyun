import React from 'react';

// This component highlights risky words inside a text block
export const HighlightedText = ({ text, risks }) => {
  if (!text) return null;

  // 1. Collect all risky words (Names + Codes)
  const badWords = new Set();
  risks.forEach(r => {
    if(r.name_en) badWords.add(r.name_en.toLowerCase());
    if(r.name_kr) badWords.add(r.name_kr);
    if(r.code) badWords.add(r.code.toLowerCase());
  });

  // 2. Split text by spaces/newlines to check words
  // This is a simple visual splitter
  const words = text.split(/(\s+)/); // Keep spaces

  return (
    <div style={{fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap'}}>
      {words.map((word, index) => {
        const cleanWord = word.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''); // Remove punctuation
        
        // Check if this word is "Bad"
        // Note: This is a simple visual check. 
        // Real matching happens in the logic, this is just for display.
        const isBad = [...badWords].some(bad => cleanWord.includes(bad) && bad.length > 2);

        return isBad ? (
          <span key={index} style={{backgroundColor: '#ffebee', color: '#c62828', fontWeight: 'bold', borderBottom: '2px solid red'}}>
            {word}
          </span>
        ) : (
          <span key={index}>{word}</span>
        );
      })}
    </div>
  );
};