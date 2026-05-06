/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CommsFeedProps {
  message: string;
}

export const CommsFeed: React.FC<CommsFeedProps> = ({ message }) => {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 mb-8 pointer-events-none w-full max-w-xl text-center">
      <AnimatePresence mode="wait">
        <motion.p 
          key={message}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.8, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="text-[12px] text-[#f0ead6] font-medium leading-relaxed italic tracking-wide"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
        >
          "{message}"
        </motion.p>
      </AnimatePresence>
    </div>
  );
};
