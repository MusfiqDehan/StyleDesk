import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './auth.module.css';

export function BackToWebsite() {
  return <Link href="/" className={styles.back} aria-label="Back to website">
    <span className={styles.backIcon}><ArrowLeft size={16} aria-hidden="true" /></span>
    <span>Back to website</span>
  </Link>;
}
