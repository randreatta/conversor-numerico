import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Trash2, Download, Terminal } from 'lucide-react';

// Sistema de Logging
class FormatadorLogger {
  constructor() {
    this.logs = [];
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notify() {
    this.listeners.forEach(callback => callback([...this.logs]));
  }

  log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    this.logs.push(logEntry);
    this.notify();
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  debug(message, data = null) {
    this.log('DEBUG', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }

  warning(message, data = null) {
    this.log('WARNING', message, data);
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  exportAsText() {
    return this.logs.map(log =>
      `[${log.timestamp}] [${log.level}] ${log.message}${log.data ? '\n  Dados: ' + JSON.stringify(log.data) : ''}`
    ).join('\n');
  }

  exportAsJSON() {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Funções utilitárias de formatação
const formatText = {
  uppercase: (text) => text.toUpperCase(),
  lowercase: (text) => text.toLowerCase(),
  capitalize: (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
  titleCase: (text) => text.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
};

const parseInput = (input, segmentationMode, logger) => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  logger.info(`Modo de segmentação: ${segmentationMode.toUpperCase()}`);

  let items = [];

  try {
    switch (segmentationMode) {
      case 'by_line':
        items = trimmed.split(/\n+/).filter(item => item.trim().length > 0);
        logger.debug('Segmentação por linha aplicada', { count: items.length });
        break;

      case 'by_space':
        items = trimmed.split(/[\s,;\t]+/).filter(item => item.length > 0);
        logger.debug('Segmentação por espaço aplicada', { count: items.length });
        break;

      case 'auto':
      default:
        if (trimmed.includes('\n')) {
          items = trimmed.split(/\n+/).filter(item => item.trim().length > 0);
          logger.debug('Auto-detecção: usando segmentação por linha', { count: items.length });
        } else {
          items = trimmed.split(/[\s,;\t]+/).filter(item => item.length > 0);
          logger.debug('Auto-detecção: usando segmentação por espaço', { count: items.length });
        }
    }

    items = items.map(item => {
      const cleaned = item.replace(/^['"]|['"]$/g, '').trim();
      return cleaned;
    });

    logger.debug('Itens após segmentação e limpeza', { items: items.slice(0, 5), total: items.length });
    return items;
  } catch (error) {
    logger.error('Erro ao segmentar entrada', { error: error.message });
    throw error;
  }
};

const detectInputType = (items, logger) => {
  const allNumbers = items.every(item => !isNaN(item) && item.trim() !== '');
  const type = allNumbers ? 'number' : 'text';
  logger.info(`Tipo detectado: ${type.toUpperCase()}`);
  return type;
};

const formatOutput = (items, config, logger) => {
  const { outputFormat, textCase, separator, withParentheses, lineBreakAfterItems } = config;

  try {
    logger.info('Iniciando formatação de saída');
    logger.debug('Configurações aplicadas', config);

    let formattedItems = items.map((item, index) => {
      if (outputFormat === 'string_quoted' || outputFormat === 'string_unquoted') {
        if (textCase && textCase !== 'original') {
          const before = item;
          item = formatText[textCase](item);
          if (index === 0) {
            logger.debug(`Aplicando transformação: ${textCase.toUpperCase()}`, { antes: before, depois: item });
          }
        }
      }

      switch (outputFormat) {
        case 'string_quoted':
          return `'${item}'`;
        case 'number':
        case 'string_unquoted':
        default:
          return item;
      }
    });

    logger.debug('Formatação individual concluída', { sample: formattedItems.slice(0, 3) });

    const actualSeparator = separator === '\\n' ? '\n' : separator;
    const finalSeparator = lineBreakAfterItems ? actualSeparator + '\n' : actualSeparator;

    logger.info(`Separador utilizado: "${actualSeparator === '\n' ? 'QUEBRA DE LINHA' : actualSeparator}"${lineBreakAfterItems ? ' + QUEBRA DE LINHA ADICIONAL' : ''}`);

    const result = formattedItems.join(finalSeparator);
    const final = withParentheses ? `(${result})` : result;

    logger.info('Saída final gerada com sucesso');
    logger.debug('Resultado final', { length: final.length, preview: final.substring(0, 100) });

    return final;
  } catch (error) {
    logger.error('Erro ao formatar saída', { error: error.message, stack: error.stack });
    throw error;
  }
};

export default function SQLFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('formatter');
  const [logs, setLogs] = useState([]);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const loggerRef = useRef(new FormatadorLogger());
  const logsEndRef = useRef(null);

  const [inputType, setInputType] = useState('auto');
  const [outputFormat, setOutputFormat] = useState('string_quoted');
  const [textCase, setTextCase] = useState('original');
  const [separator, setSeparator] = useState(', ');
  const [customSeparator, setCustomSeparator] = useState('');
  const [withParentheses, setWithParentheses] = useState(true);
  const [segmentationMode, setSegmentationMode] = useState('auto');
  const [lineBreakAfterItems, setLineBreakAfterItems] = useState(false);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const logger = loggerRef.current;
    const updateLogs = (newLogs) => setLogs(newLogs);
    logger.addListener(updateLogs);

    return () => {
      logger.removeListener(updateLogs);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleFormat = () => {
    const logger = loggerRef.current;

    try {
      logger.clear();
      logger.info('========== NOVA EXECUÇÃO ==========');
      logger.info('Entrada recebida', { length: input.length, lines: input.split('\n').length });

      const items = parseInput(input, segmentationMode, logger);

      if (items.length === 0) {
        logger.warning('Nenhum item encontrado na entrada');
        return;
      }

      const detectedType = inputType === 'auto' ? detectInputType(items, logger) : inputType;
      logger.info(`Tipo de entrada: ${inputType === 'auto' ? 'AUTO (' + detectedType + ')' : inputType.toUpperCase()}`);

      let finalFormat = outputFormat;
      if (detectedType === 'number' && outputFormat === 'string_unquoted') {
        finalFormat = 'number';
        logger.debug('Formato ajustado automaticamente para NUMBER');
      }

      const config = {
        outputFormat: finalFormat,
        textCase: detectedType === 'text' ? textCase : null,
        separator: separator === 'custom' ? customSeparator : separator,
        withParentheses,
        lineBreakAfterItems
      };

      logger.info(`Formato de saída: ${finalFormat.toUpperCase()}`);
      if (detectedType === 'text' && textCase !== 'original') {
        logger.info(`Transformação de texto: ${textCase.toUpperCase()}`);
      }

      const result = formatOutput(items, config, logger);
      setOutput(result);
      setItemCount(items.length);

      logger.info('========== EXECUÇÃO CONCLUÍDA ==========');

    } catch (error) {
      logger.error('ERRO CRÍTICO NA EXECUÇÃO', {
        message: error.message,
        stack: error.stack
      });
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = output;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err2) {
        console.error('Fallback copy failed:', err2);
      }
      document.body.removeChild(textArea);
    }
  };

  const copyLogs = async () => {
    try {
      const logsText = loggerRef.current.exportAsText();
      await navigator.clipboard.writeText(logsText);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar logs:', err);
    }
  };

  const clearLogs = () => {
    loggerRef.current.clear();
  };

  const downloadLogs = (format = 'txt') => {
    const content = format === 'json'
      ? loggerRef.current.exportAsJSON()
      : loggerRef.current.exportAsText();

    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().getTime()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setCopied(false);
    setItemCount(0);
    loggerRef.current.clear();
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'ERROR':   return 'text-red-400 border-l-2 border-red-500 pl-2';
      case 'WARNING': return 'text-yellow-300 border-l-2 border-yellow-500 pl-2';
      case 'DEBUG':   return 'text-purple-400 border-l-2 border-purple-500 pl-2';
      case 'INFO':
      default:        return 'text-emerald-400 border-l-2 border-emerald-500 pl-2';
    }
  };

  const getLogBadgeColor = (level) => {
    switch (level) {
      case 'ERROR':   return 'bg-red-700 text-red-200';
      case 'WARNING': return 'bg-yellow-700 text-yellow-200';
      case 'DEBUG':   return 'bg-purple-700 text-purple-200';
      case 'INFO':
      default:        return 'bg-emerald-800 text-emerald-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-slate-50 to-indigo-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden ring-1 ring-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm flex items-center justify-center w-12 h-12">
                <span className="text-2xl leading-none select-none" role="img" aria-label="preguiça">🦥</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Formatador SQL</h1>
                <p className="text-violet-200 text-sm mt-0.5">Converta listas em cláusulas SQL formatadas</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('formatter')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'formatter'
                  ? 'bg-white text-violet-600 border-b-2 border-violet-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Formatador
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-white text-violet-600 border-b-2 border-violet-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Terminal size={18} />
              Console ({logs.length})
            </button>
          </div>

          <div className="p-6">
            {/* Aba Formatador */}
            {activeTab === 'formatter' && (
              <>
                {/* Entrada */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Dados de entrada
                  </label>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none font-mono text-sm placeholder:text-gray-400"
                  />
                </div>

                {/* Configurações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  {/* Tipo de entrada */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                      Tipo de entrada
                    </label>
                    <select
                      value={inputType}
                      onChange={(e) => setInputType(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="auto">Auto-detectar</option>
                      <option value="number">Números</option>
                      <option value="text">Texto</option>
                    </select>
                  </div>

                  {/* Segmentação de entrada */}
                  {inputType === 'text' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                        Segmentação
                      </label>
                      <select
                        value={segmentationMode}
                        onChange={(e) => setSegmentationMode(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="auto">Auto-detectar</option>
                        <option value="by_line">Por linha (nomes completos)</option>
                        <option value="by_space">Por espaço (palavras)</option>
                      </select>
                    </div>
                  )}

                  {/* Formato de saída */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                      Formato de saída
                    </label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="string_quoted">Com aspas ('123')</option>
                      <option value="string_unquoted">Sem aspas (123)</option>
                      <option value="number">Número (123)</option>
                    </select>
                  </div>

                  {/* Formatação de texto */}
                  {(inputType === 'text' || inputType === 'auto') && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                        Capitalização
                      </label>
                      <select
                        value={textCase}
                        onChange={(e) => setTextCase(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="original">Original</option>
                        <option value="uppercase">MAIÚSCULO</option>
                        <option value="lowercase">minúsculo</option>
                        <option value="capitalize">Capitalize</option>
                        <option value="titleCase">Title Case</option>
                      </select>
                    </div>
                  )}

                  {/* Separador */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                      Separador
                    </label>
                    <select
                      value={separator}
                      onChange={(e) => setSeparator(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">Nenhum</option>
                      <option value=", ">Vírgula com espaço (, )</option>
                      <option value=",">Vírgula (,)</option>
                      <option value="; ">Ponto e vírgula (; )</option>
                      <option value=" ">Espaço ( )</option>
                      <option value="|">Pipe (|)</option>
                      <option value="\n">Quebra de linha (um por linha)</option>
                      <option value="custom">Customizado</option>
                    </select>
                    {separator === 'custom' && (
                      <input
                        type="text"
                        value={customSeparator}
                        onChange={(e) => setCustomSeparator(e.target.value)}
                        placeholder="Ex: → ou | ou ;"
                        className="w-full mt-2 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                      />
                    )}
                  </div>

                  {/* Parênteses */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="parentheses"
                      checked={withParentheses}
                      onChange={(e) => setWithParentheses(e.target.checked)}
                      className="w-4 h-4 text-violet-600 rounded focus:ring-2 focus:ring-violet-500"
                    />
                    <label htmlFor="parentheses" className="ml-2 text-sm text-gray-600">
                      Envolver com parênteses <span className="text-gray-400 font-mono">( )</span>
                    </label>
                  </div>

                  {/* Quebra de linha após itens */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="lineBreak"
                      checked={lineBreakAfterItems}
                      onChange={(e) => setLineBreakAfterItems(e.target.checked)}
                      className="w-4 h-4 text-violet-600 rounded focus:ring-2 focus:ring-violet-500"
                    />
                    <label htmlFor="lineBreak" className="ml-2 text-sm text-gray-600">
                      Quebra de linha entre os itens
                    </label>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={handleFormat}
                    disabled={!input.trim()}
                    className="flex-1 bg-violet-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-violet-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Formatar
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Limpar
                  </button>
                </div>

                {/* Saída */}
                {output && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                          Saída gerada
                        </label>
                        <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                      >
                        {copied ? (
                          <>
                            <Check size={16} />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={output}
                      readOnly
                      className="w-full h-32 p-3 border border-emerald-300 bg-emerald-50 rounded-lg font-mono text-sm resize-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* Aba Logs */}
            {activeTab === 'logs' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Terminal size={22} className="text-violet-600" />
                    Console de Logs
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={copyLogs}
                      disabled={logs.length === 0}
                      className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      {copiedLogs ? (
                        <>
                          <Check size={16} />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copiar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => downloadLogs('txt')}
                      disabled={logs.length === 0}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      <Download size={16} />
                      TXT
                    </button>
                    <button
                      onClick={() => downloadLogs('json')}
                      disabled={logs.length === 0}
                      className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      <Download size={16} />
                      JSON
                    </button>
                    <button
                      onClick={clearLogs}
                      disabled={logs.length === 0}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      <Trash2 size={16} />
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-gray-700 shadow-inner">
                  {/* Terminal title bar */}
                  <div className="bg-gray-800 px-4 py-2.5 flex items-center gap-2 border-b border-gray-700">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="ml-3 text-gray-400 text-xs font-mono">formatador.log</span>
                  </div>
                  <div className="bg-gray-950 p-4 h-80 overflow-y-auto font-mono text-sm">
                    {logs.length === 0 ? (
                      <div className="text-gray-600 text-center py-8">
                        Nenhum log disponível. Execute uma formatação para visualizar os logs.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {logs.map((log, index) => (
                          <div key={index} className={`py-1 ${getLogColor(log.level)}`}>
                            <div className="flex items-start gap-2">
                              <span className="text-gray-600 text-xs shrink-0">{log.timestamp}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${getLogBadgeColor(log.level)}`}>
                                {log.level}
                              </span>
                              <span className="flex-1 text-gray-100">{log.message}</span>
                            </div>
                            {log.data && (
                              <div className="mt-1 ml-20 text-xs text-gray-500">
                                <pre className="whitespace-pre-wrap">{JSON.stringify(log.data, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
