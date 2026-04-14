import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Trash2,
  Download,
  Plus,
  Moon,
  Sun,
  Settings2,
  Wind
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toaster, toast } from 'sonner';
import { extractFanSchedule } from './services/geminiService';
import { generateExcel } from './services/excelService';
import { FanSchedule } from './types';

export default function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [schedule, setSchedule] = useState<FanSchedule | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleProcess = async () => {
    if (files.length === 0 && !pastedText.trim()) {
      toast.error('Please provide some data or upload a file.');
      return;
    }

    setIsProcessing(true);
    try {
      let combinedSchedule: FanSchedule = { tabs: [] };
      
      if (files.length > 0) {
        for (const file of files) {
          const base64 = await fileToBase64(file);
          const result = await extractFanSchedule({
            data: base64.split(',')[1],
            mimeType: file.type
          });
          
          // Merge tabs
          result.tabs.forEach(newTab => {
            const existingTab = combinedSchedule.tabs.find(t => t.typeName === newTab.typeName);
            if (existingTab) {
              if (newTab.groups) existingTab.groups.push(...newTab.groups);
              if (newTab.specNotes) {
                existingTab.specNotes = [...(existingTab.specNotes || []), ...newTab.specNotes];
                // Remove duplicates from specNotes
                existingTab.specNotes = Array.from(new Set(existingTab.specNotes));
              }
            } else {
              combinedSchedule.tabs.push({
                ...newTab,
                specNotes: newTab.specNotes || [],
                groups: newTab.groups || []
              });
            }
          });
        }
      } else {
        const result = await extractFanSchedule(pastedText);
        combinedSchedule = {
          tabs: result.tabs.map(tab => ({
            ...tab,
            specNotes: tab.specNotes || [],
            groups: tab.groups || []
          }))
        };
      }

      setSchedule(combinedSchedule);
      toast.success('Data extracted successfully!');
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === 'API_KEY_MISSING') {
        toast.error('Gemini API Key is missing. Please check your environment configuration.', {
          description: 'If running on Vercel, ensure VITE_GEMINI_API_KEY is set.',
          duration: 6000
        });
      } else {
        toast.error('Failed to process data. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleExport = async () => {
    if (!schedule) return;
    try {
      await generateExcel(schedule);
      toast.success('Excel workbook generated!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate Excel.');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Check if we are in a deployment (like Vercel) but missing the key
  const isMissingApiKey = !(import.meta as any).env.VITE_GEMINI_API_KEY && 
                         !(globalThis as any).process?.env?.GEMINI_API_KEY &&
                         window.location.hostname !== 'localhost' &&
                         !window.location.hostname.includes('run.app');

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 font-sans selection:bg-primary/10">
      <Toaster position="top-right" theme={isDarkMode ? 'dark' : 'light'} richColors />
      
      {isMissingApiKey && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
          <Card className="max-w-md border-primary/20 shadow-2xl rounded-[2rem]">
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Settings2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-black">Setup Required</CardTitle>
              <CardDescription className="font-bold text-xs uppercase tracking-widest mt-2">
                Deployment detected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                To use this app on your own domain, you need to add your <strong>Gemini API Key</strong> to your hosting provider's environment variables.
              </p>
              <div className="bg-muted/50 p-4 rounded-xl font-mono text-[10px] break-all border border-border/40">
                Key: VITE_GEMINI_API_KEY<br/>
                Value: [Your API Key]
              </div>
              <Button 
                className="w-full h-12 rounded-xl bg-primary font-bold"
                onClick={() => window.open("https://aistudio.google.com/app/apikey", "_blank")}
              >
                Get Free API Key
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Once added, redeploy or refresh this page.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-8">
          <div className="flex items-center gap-5">
            <div className="bg-primary p-3.5 rounded-2xl shadow-2xl shadow-primary/20 ring-1 ring-primary/50">
              <Wind className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl md:text-4xl font-black tracking-tighter"
              >
                FAN<span className="text-primary">SCHED</span>
                <span className="text-primary/30 ml-1">v2.0</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground text-xs font-bold uppercase tracking-[0.3em] mt-1"
              >
                High-Precision Schedule Extraction
              </motion.p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-muted/30 p-1 rounded-xl border border-border/40">
              <Button
                variant={!isDarkMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsDarkMode(false)}
                className="rounded-lg px-3 h-8"
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant={isDarkMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsDarkMode(true)}
                className="rounded-lg px-3 h-8"
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
            </div>
            
            {schedule && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Button 
                  onClick={handleExport}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-10 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Generate Excel
                </Button>
              </motion.div>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Input Section */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
            <Card className="border-border/40 bg-card/30 backdrop-blur-xl shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="pb-6 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Workbench</CardTitle>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="pt-8 space-y-8">
                {/* Dropzone */}
                <div 
                  {...getRootProps()} 
                  className={`
                    relative group border-2 border-dashed rounded-[2rem] p-8 transition-all duration-500 cursor-pointer
                    flex flex-col items-center justify-center text-center gap-4
                    ${isDragActive ? 'border-primary bg-primary/10 scale-[0.98]' : 'border-border/60 hover:border-primary/40 hover:bg-muted/20'}
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="bg-muted/50 p-5 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm">Upload Schedules</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">PDF • JPG • PNG</p>
                  </div>
                </div>

                {/* File List */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="grid grid-cols-1 gap-2"
                    >
                      {files.map((file, i) => (
                        <motion.div 
                          key={i} 
                          layout
                          className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/20 group hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-primary/10 p-2 rounded-lg">
                              <FileText className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-[11px] font-bold truncate">{file.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeFile(i)} 
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/20" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-4 text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">Manual Entry</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea
                    placeholder="Paste raw text data here..."
                    className="w-full min-h-[160px] p-5 rounded-[1.5rem] border border-border/40 bg-muted/10 focus:ring-4 focus:ring-primary/5 focus:border-primary/40 outline-none transition-all resize-none text-xs font-mono leading-relaxed"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />

                  <Button 
                    onClick={handleProcess} 
                    disabled={isProcessing}
                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/20 transition-all active:scale-[0.98]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Processing Engine...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-3 h-5 w-5" />
                        Analyze & Convert
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Preview Section */}
          <section className="lg:col-span-8 min-w-0">
            <AnimatePresence mode="wait">
              {!schedule ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="h-[600px] flex flex-col items-center justify-center p-12 text-center space-y-8 bg-card/20 backdrop-blur-sm rounded-[3rem] border border-dashed border-border/40"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                    <div className="relative bg-muted/50 p-10 rounded-full border border-border/40 shadow-inner">
                      <FileSpreadsheet className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black tracking-tight">System Ready</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed font-medium">
                      Upload your HVAC schedules to begin extraction. Our AI engine will automatically group and format your data.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="data"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {schedule.tabs.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center p-12 text-center space-y-4 bg-card/20 backdrop-blur-sm rounded-[3rem] border border-border/40">
                      <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-muted-foreground font-medium">No schedule data could be extracted from the provided input.</p>
                      <Button variant="outline" onClick={() => setSchedule(null)}>Try Again</Button>
                    </div>
                  ) : (
                    <Tabs defaultValue={schedule.tabs[0]?.typeName || ""} className="w-full">
                      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md py-4 -mx-4 px-4 mb-6 border-b border-border/20">
                        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/20 h-auto flex-wrap justify-start gap-1">
                          {schedule.tabs.map((tab) => (
                            <TabsTrigger 
                              key={tab.typeName} 
                              value={tab.typeName}
                              className="rounded-lg px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all shadow-none"
                            >
                              {tab.typeName}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>

                      {schedule.tabs.map((tab) => (
                        <TabsContent key={tab.typeName} value={tab.typeName} className="space-y-8 focus-visible:outline-none mt-0">
                          {/* Spec Notes */}
                          {(tab.specNotes?.length ?? 0) > 0 && (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                            >
                              <Card className="border-none shadow-2xl bg-primary/[0.03] rounded-[2rem] overflow-hidden">
                                <div className="bg-primary/5 px-8 py-4 border-b border-primary/10">
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                                    <AlertCircle className="h-4 w-4" />
                                    Technical Specification Notes
                                  </h4>
                                </div>
                                <CardContent className="p-8">
                                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 list-none text-[11px] font-bold text-muted-foreground/80 leading-relaxed">
                                    {tab.specNotes?.map((note, i) => (
                                      <li key={i} className="flex gap-4 items-start">
                                        <span className="text-primary font-black bg-primary/10 px-2 py-0.5 rounded text-[9px]">{i + 1}</span>
                                        <span className="flex-1">{note}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </CardContent>
                              </Card>
                            </motion.div>
                          )}

                          {/* Data Groups */}
                          <div className="space-y-10">
                            {tab.groups?.map((group, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                              >
                                <div className="flex items-center gap-4 mb-4 px-2">
                                  <div className="h-px flex-1 bg-border/40" />
                                  <div className="flex items-center gap-3">
                                    <span className="font-black text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                                      {group.cfm} CFM @ {group.esp} in.WG
                                    </span>
                                    <span className="bg-primary/10 text-primary text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                                      {group.fans?.length || 0} Units
                                    </span>
                                  </div>
                                  <div className="h-px flex-1 bg-border/40" />
                                </div>

                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm shadow-2xl rounded-[2rem] overflow-hidden">
                                  <ScrollArea className="w-full">
                                    <div className="min-w-[900px]">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="hover:bg-transparent border-border/20 bg-muted/30">
                                            <TableHead className="py-5 px-8 text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">Tag</TableHead>
                                            <TableHead className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">Manufacturer / Model</TableHead>
                                            <TableHead className="text-center text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">CFM</TableHead>
                                            <TableHead className="text-center text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">ESP</TableHead>
                                            <TableHead className="text-center text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">RPM</TableHead>
                                            <TableHead className="text-center text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">HP</TableHead>
                                            <TableHead className="text-right pr-8 text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">Volt / Ph</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.fans?.map((fan, j) => (
                                            <TableRow key={j} className="border-border/10 hover:bg-primary/[0.02] transition-colors">
                                              <TableCell className="py-5 px-8 font-black text-sm tracking-tighter text-primary">{fan.tag}</TableCell>
                                              <TableCell>
                                                <div className="font-black text-[11px] uppercase tracking-tight">{fan.manufacturer || '—'}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono mt-1 opacity-70">{fan.model || '—'}</div>
                                              </TableCell>
                                              <TableCell className="text-center font-mono text-xs font-bold">{fan.cfm}</TableCell>
                                              <TableCell className="text-center font-mono text-xs font-bold">{fan.esp}</TableCell>
                                              <TableCell className="text-center font-mono text-xs font-bold opacity-60">{fan.rpm || '—'}</TableCell>
                                              <TableCell className="text-center font-mono text-xs font-bold opacity-60">{fan.hp || '—'}</TableCell>
                                              <TableCell className="text-right pr-8 font-mono text-[11px] font-black text-muted-foreground/80">
                                                {fan.voltage || '—'}<span className="mx-1 text-primary/30">/</span>{fan.phase || '—'}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </ScrollArea>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>

        {/* Footer */}
        <footer className="pt-16 pb-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground/60">
              FanSched Engineering Systems &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex gap-8">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-primary transition-colors cursor-help">Documentation</span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-primary transition-colors cursor-help">API Status</span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-primary transition-colors cursor-help">Security</span>
          </div>
        </footer>
      </div>
    </div>

  );
}
