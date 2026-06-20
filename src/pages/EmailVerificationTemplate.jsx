export default function EmailVerificationTemplate() {
  // 演示用数据，实际发送时替换这些变量
  const userName = "周防桃子";
  const verificationCode = "847291";
  const expireMinutes = 30;

  return (
    <div style={{ backgroundColor: "#f5f5f5", minHeight: "100vh", fontFamily: "'PingFang SC', 'Microsoft YaHei', Arial, sans-serif" }}>
      <table width="100%" cellPadding="0" cellSpacing="0" style={{ backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
        <tbody>
          <tr>
            <td align="center" style={{ padding: "40px 16px" }}>

              {/* 主体卡片 */}
              <table width="600" cellPadding="0" cellSpacing="0" style={{
                maxWidth: "600px",
                width: "100%",
                backgroundColor: "#ffffff",
                borderRadius: "4px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
              }}>
                <tbody>

                  {/* Header */}
                  <tr>
                    <td style={{ padding: "28px 40px 20px", borderBottom: "1px solid #f0f0f0" }}>
                      <table width="100%" cellPadding="0" cellSpacing="0">
                        <tbody>
                          <tr>
                            <td>
                              {/* Logo 区域 */}
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{
                                  width: "36px", height: "36px", borderRadius: "8px",
                                  backgroundColor: "#dc2626",
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  verticalAlign: "middle"
                                }}>
                                  <span style={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}>同一</span>
                                </div>
                                <span style={{ fontSize: "18px", fontWeight: "600", color: "#111", verticalAlign: "middle", marginLeft: "8px" }}>
                                  同一物流
                                </span>
                              </div>
                            </td>
                            <td align="right" style={{ verticalAlign: "middle" }}>
                              <span style={{ fontSize: "12px", color: "#888" }}>
                                如果您不想收到此类邮件，请
                                <a href="#" style={{ color: "#dc2626", textDecoration: "none", marginLeft: "4px" }}>点击退订</a>
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* 正文 */}
                  <tr>
                    <td style={{ padding: "36px 40px 40px" }}>

                      {/* 问候语 */}
                      <p style={{ fontSize: "15px", color: "#333", margin: "0 0 24px 0", fontWeight: "500" }}>
                        尊敬的同一物流用户，{userName}，您好！
                      </p>

                      {/* 验证码说明 */}
                      <div style={{
                        backgroundColor: "#fafafa",
                        border: "1px solid #f0f0f0",
                        borderRadius: "4px",
                        padding: "24px 28px",
                        marginBottom: "24px"
                      }}>
                        <p style={{ fontSize: "14px", color: "#444", margin: "0 0 16px 0" }}>
                          您正在进行账号邮箱验证操作，验证码为：
                        </p>
                        <div style={{
                          display: "inline-block",
                          backgroundColor: "#dc2626",
                          color: "#ffffff",
                          fontSize: "28px",
                          fontWeight: "bold",
                          letterSpacing: "8px",
                          padding: "10px 28px",
                          borderRadius: "4px",
                          fontFamily: "monospace"
                        }}>
                          {verificationCode}
                        </div>
                      </div>

                      {/* 有效期说明 */}
                      <p style={{ fontSize: "14px", color: "#333", margin: "0 0 8px 0", fontWeight: "500" }}>
                        此验证码只能使用一次，验证成功自动失效
                      </p>
                      <p style={{ fontSize: "13px", color: "#888", margin: "0 0 24px 0", lineHeight: "1.6" }}>
                        （请在 {expireMinutes} 分钟内完成验证，{expireMinutes} 分钟后验证码失效，您需要重新获取验证码。感谢您对同一物流的支持）
                      </p>

                      {/* 误收提示 */}
                      <p style={{ fontSize: "13px", color: "#aaa", margin: "0" }}>
                        如果您误收到了本电子邮件，请忽略上述内容。
                      </p>

                    </td>
                  </tr>

                  {/* Footer */}
                  <tr>
                    <td style={{ borderTop: "1px solid #f0f0f0", padding: "20px 40px", textAlign: "center" }}>
                      <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#999" }}>
                        此邮件由同一物流系统发出，系统不接收回复，请勿直接回复。
                      </p>
                      <div style={{ margin: "0 0 6px 0" }}>
                        <a href="#" style={{ fontSize: "13px", color: "#666", textDecoration: "none" }}>帮助中心</a>
                        <span style={{ color: "#ccc", margin: "0 8px" }}>·</span>
                        <a href="#" style={{ fontSize: "13px", color: "#666", textDecoration: "none" }}>常见问题</a>
                      </div>
                      <p style={{ margin: "0", fontSize: "12px", color: "#bbb" }}>
                        © 2026 同一物流 Tongyi Express · 日本 → 全球 · 安心・信頼・快捷
                      </p>
                    </td>
                  </tr>

                </tbody>
              </table>

            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}