import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import 'katex/dist/katex.min.css';
<<<<<<< HEAD
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

=======
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);

>>>>>>> 678fcbf (separate repository to flownote-service)

interface ReactMarkdownRenderProps {
    message : string;
}


const ReactMarkdownRender = ({message}:ReactMarkdownRenderProps) => {
    return(
        <ReactMarkdown
            remarkPlugins={[remarkGfm,remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
<<<<<<< HEAD
                code(props: any) {
                    const { children, className, node, ...rest } = props;
=======
                code({ children, className }) {
>>>>>>> 678fcbf (separate repository to flownote-service)
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                        <div className="my-2 rounded-md overflow-hidden">
                            <SyntaxHighlighter
<<<<<<< HEAD
                                {...rest}
=======
>>>>>>> 678fcbf (separate repository to flownote-service)
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        </div>
                    ) : (
<<<<<<< HEAD
                        <code className="bg-gray-200 text-red-500 px-1 rounded" {...rest}>
=======
                        <code className="bg-gray-200 text-red-500 px-1 rounded">
>>>>>>> 678fcbf (separate repository to flownote-service)
                            {children}
                        </code>
                    );
                },
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
<<<<<<< HEAD
=======
                a: ({ children, href }) => {
                    const label = String(children);
                    if (href && label.startsWith("동영상:")) {
                        return (
                            <span className="my-2 block">
                                <video className="max-h-80 max-w-full rounded-lg border bg-black" src={href} controls />
                                <a className="mt-1 inline-block font-semibold underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
                                    {children}
                                </a>
                            </span>
                        );
                    }

                    return (
                        <a className="font-semibold underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
                            {children}
                        </a>
                    );
                },
                img: ({ alt, src }) => (
                    <img className="my-2 max-h-64 rounded-lg border object-contain" alt={alt ?? "uploaded"} src={src ?? ""} />
                ),
>>>>>>> 678fcbf (separate repository to flownote-service)
                u: ({ children }) => <span className="underline">{children}</span>,
            }}
        >
            {message}
        </ReactMarkdown>
    );
}

export default ReactMarkdownRender;
