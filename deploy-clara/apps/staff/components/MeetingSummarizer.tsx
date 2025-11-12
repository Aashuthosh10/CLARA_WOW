import React, { useState } from 'react';
import { summarizeText } from '../services/geminiService';

const MeetingSummarizer: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSummarize = async () => {
        if (!inputText.trim()) {
            setError("Please enter some text to summarize.");
            return;
        }
        setIsLoading(true);
        setError('');
        setSummary('');
        try {
            const result = await summarizeText(inputText);
            setSummary(result);
        } catch (e) {
            setError("Failed to generate summary. Please try again.");
            console.error(e);
        }
        setIsLoading(false);
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-6 text-white">
            {/* Input Section */}
            <div className="w-full md:w-1/2 flex flex-col bg-slate-900/50 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold mb-4">Meeting Notes / Transcript</h2>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your meeting notes or transcript here..."
                    className="flex-grow w-full bg-slate-900/80 border border-slate-700 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none"
                    aria-label="Meeting notes input"
                />
                <button
                    onClick={handleSummarize}
                    disabled={isLoading}
                    className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-600 disabled:scale-100"
                >
                    {isLoading ? (
                        <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Generating Summary...</>
                    ) : (
                        <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Generate Summary</>
                    )}
                </button>
                {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
            </div>

            {/* Output Section */}
            <div className="w-full md:w-1/2 flex flex-col bg-slate-900/50 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-bold mb-4">AI-Generated Summary</h2>
                <div className="flex-grow overflow-y-auto pr-2 bg-slate-900/80 border border-slate-700 rounded-lg p-4">
                    {isLoading && (
                        <div className="flex items-center justify-center h-full text-slate-400">
                           <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
                        </div>
                    )}
                    {!isLoading && !summary && (
                        <div className="flex items-center justify-center h-full text-slate-400">
                           <p>Your summary will appear here.</p>
                        </div>
                    )}
                    {summary && (
                        <div
                            className="prose prose-invert prose-p:text-slate-300 prose-headings:text-white"
                            dangerouslySetInnerHTML={{
                                __html: summary
                                    .replace(/### (.*)/g, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                                    .replace(/\* (.*)/g, '<li class="ml-4 list-disc">$1</li>')
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeetingSummarizer;
