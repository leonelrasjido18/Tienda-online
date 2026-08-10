/**
 * Inline script that sets data-theme on <html> BEFORE the first paint.
 * Must be rendered inside <head> to avoid FOUC.
 * Uses dangerouslySetInnerHTML because Next.js 15+ escapes children of <script>.
 */
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}else if(matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark')}else{document.documentElement.setAttribute('data-theme','light')}}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`,
      }}
    />
  );
}
