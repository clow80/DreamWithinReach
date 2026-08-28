import { useState } from 'react';
import { DiscussionEmbed, CommentCount } from 'disqus-react';

interface ArticleProps {
  id: string;
  title: string;
  url: string;
  language?: string;
}

export function DisqusArticleComments({ article }: { article: ArticleProps }) {
  const disqusShortname = 'dreamwithinreach';
  const disqusConfig = {
    url: article.url || window.location.href,
    identifier: article.id,
    title: article.title,
    language: 'en'
  };

  return (
    <div className="disqus-react-container p-6 bg-slate-900/90 text-white rounded-xl border border-slate-700 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{article.title}</h2>
          <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
            <span>Disqus Shortname: <strong className="text-amber-400">{disqusShortname}</strong></span>
            <span>&bull;</span>
            <CommentCount shortname={disqusShortname} config={disqusConfig}>
              Comments
            </CommentCount>
          </div>
        </div>

        {/* Language Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Language:
          </span>
          <span className="bg-slate-800 border border-slate-700 text-amber-300 text-xs rounded-lg px-2.5 py-1 font-medium">
            English (en)
          </span>
        </div>
      </div>

      {/* Discussion Embed */}
      <div className="disqus-embed-wrapper bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
        <DiscussionEmbed shortname={disqusShortname} config={disqusConfig} />
      </div>
    </div>
  );
}

export default function App() {
  const [selectedThread, setSelectedThread] = useState('dreamwithinreach-main-page');

  const threads: Record<string, ArticleProps> = {
    'dreamwithinreach-main-page': {
      id: 'dreamwithinreach-main-page',
      title: '🏠 DreamWithinReach Main Page Community Discussion',
      url: typeof window !== 'undefined' ? `${window.location.origin}/#dreamwithinreach-main-page` : 'https://dreamwithinreach.disqus.com',
      language: 'en'
    },
    'sg-hdb-sunlight-guide-2026': {
      id: 'sg-hdb-sunlight-guide-2026',
      title: '☀️ Solar Orientation & Thermal Comfort Discussion',
      url: typeof window !== 'undefined' ? `${window.location.origin}/#sg-hdb-sunlight-guide-2026` : 'https://dreamwithinreach.disqus.com',
      language: 'en'
    },
    'sg-cpf-housing-grants': {
      id: 'sg-cpf-housing-grants',
      title: '💰 CPF Housing Grants & Budget Optimization',
      url: typeof window !== 'undefined' ? `${window.location.origin}/#sg-cpf-housing-grants` : 'https://dreamwithinreach.disqus.com',
      language: 'en'
    }
  };

  const activeArticle = threads[selectedThread] || threads['dreamwithinreach-main-page'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🏠</span> DreamWithinReach &bull; Community Discussion
          </h1>
          <p className="text-sm text-slate-400">Powered by Disqus Commenting Platform (English)</p>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {Object.keys(threads).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedThread(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedThread === key
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {threads[key].title}
              </button>
            ))}
          </div>
        </header>

        <DisqusArticleComments article={activeArticle} />
      </div>
    </div>
  );
}

