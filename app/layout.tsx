import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Алхимическая лавка — зелья лечения',description:'Один флакон. Один бросок. Ещё одно приключение.',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
