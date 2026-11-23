import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Алхимический архив — каталог зелий',description:'Прототип каталога, печатных QR-бирок и передаваемого инвентаря для D&D.',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
