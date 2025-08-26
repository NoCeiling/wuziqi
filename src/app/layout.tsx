import "./globals.css";

export const metadata = {
  title: "五子棋游戏 - 在线对战",
  description: "与朋友一起享受经典五子棋游戏的在线对战平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <head>
        {/* 禁用开发模式热重载 */}
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if (typeof window !== 'undefined') {
                  window.__NEXT_RELOAD_SCRIPT_DISABLED = true;
                }
              `,
            }}
          />
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
