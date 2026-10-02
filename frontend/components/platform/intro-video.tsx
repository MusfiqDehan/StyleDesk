"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, Download, PlayCircle, Film, Check, Pause } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import timeline from './intro-timeline.json';

const source = '/marketing/styledesk-intro.mp4';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** One self-hosted film, with chapter navigation and a readable transcript. */
export function IntroVideo() {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLAnchorElement>(null);
  const chapterIndex = Math.max(0, timeline.scenes.findLastIndex(scene => time >= scene.start));
  const playChapter = (start: number) => {
    if (!video.current) return;
    video.current.currentTime = start;
    video.current.scrollIntoView({ block: 'nearest' });
    setTime(start);
    void video.current.play().catch(() => setError('Use the video’s Play control to start the tour.'));
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <a ref={trigger} href={source} className="platform-video-trigger" aria-haspopup="dialog" onClick={event => {
      event.preventDefault(); setTime(0); setError(''); setPlaying(false); setOpen(true);
    }}>
      <span className="platform-video-trigger-icon"><PlayCircle size={23} aria-hidden="true"/></span>
      <span><strong>Watch the StyleDesk story</strong><small>{clock(Math.round(timeline.duration))} · A narrated product tour</small></span>
      <ArrowRight size={17} aria-hidden="true"/>
    </a>
    <DialogContent className="platform-intro-dialog" overlayClassName="z-[80]" onCloseAutoFocus={event => {event.preventDefault(); trigger.current?.focus();}}>
      <header className="platform-intro-header">
        <span className="platform-intro-label"><Film size={15} aria-hidden="true"/> Meet StyleDesk</span>
        <DialogTitle>A clearer day starts here.</DialogTitle>
        <DialogDescription>Explore how your bookings, people, payments and brand fit together.</DialogDescription>
      </header>
      <div className="platform-intro-body">
        <div className="platform-intro-experience">
        <div className="platform-intro-stage">
        <div className="platform-intro-screen">
          <video ref={video} controls playsInline preload="metadata" poster="/marketing/styledesk-intro-poster.jpg" aria-label="StyleDesk narrated product introduction" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onError={() => setError('The video could not load. Please try again or download the MP4 below.')}>
            <source src={source} type="video/mp4"/>
            <track kind="captions" src="/marketing/styledesk-intro.vtt" srcLang="en" label="English"/>
            Your browser does not support video. <a href={source}>Download the introduction</a>.
          </video>
        </div>
        {error && <p className="platform-intro-error" role="alert">{error}</p>}
        <div className="platform-intro-playbar"><button type="button" className="platform-intro-play" aria-label={playing ? 'Pause introduction' : 'Play introduction'} onClick={() => {
          if (playing) video.current?.pause(); else void video.current?.play().catch(() => setError('Use the video’s Play control to start the tour.'));
        }}>{playing ? <Pause size={16} aria-hidden="true"/> : <PlayCircle size={17} aria-hidden="true"/>}{playing ? 'Pause story' : 'Play story'}</button><span>{clock(time)} / {clock(Math.round(timeline.duration))}</span></div>
        </div>
        <aside className="platform-intro-chapter-panel">
        <div className="platform-intro-chapters-head"><strong>Explore the story</strong><span aria-live="polite">{timeline.scenes[chapterIndex].chapter}</span></div>
        <nav className="platform-intro-chapters" aria-label="Video chapters">
          {timeline.scenes.map((scene, index) => <button type="button" key={scene.id} aria-label={`Play chapter ${index+1}: ${scene.chapter}`} aria-current={chapterIndex===index ? 'step' : undefined} onClick={() => playChapter(scene.start)}>
            <span className="platform-intro-chapter-number">{chapterIndex===index ? <PlayCircle size={15} aria-hidden="true"/> : time>=scene.start+scene.duration ? <Check size={15} aria-hidden="true"/> : String(index+1).padStart(2,'0')}</span>
            <span>{scene.chapter}<small>{clock(scene.start)}</small></span>
          </button>)}
        </nav>
        </aside>
        </div>
        <div className="platform-intro-footer">
          <div><strong>Your craft deserves a clear desk.</strong><p>Capabilities and availability follow your selected package.</p></div>
          <Link href="/register" className="platform-btn primary" onClick={() => setOpen(false)}>Find your workspace <ArrowRight size={16}/></Link>
          <a href={source} download="styledesk-intro.mp4" className="platform-intro-download"><Download size={16} aria-hidden="true"/> Download MP4</a>
        </div>
        <details className="platform-intro-transcript"><summary>Read the transcript</summary><div>{timeline.scenes.map(scene=><section key={scene.id}><h3>{scene.chapter}</h3><p>{scene.lines.join(' ').replaceAll('Style Desk','StyleDesk')}</p></section>)}</div></details>
      </div>
    </DialogContent>
  </Dialog>;
}
