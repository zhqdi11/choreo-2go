const express = require("express");
const { exec, execSync } = require("child_process");
const app = express();

const port = process.env.SERVER_PORT || process.env.PORT || 3000;
const UUID = process.env.UUID || 'fc639b51-54e2-4e14-b52d-dad26967e5c7';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nz.5980268.xyz:443';
const NEZHA_KEY = process.env.NEZHA_KEY || 'q6ysGEq6weKxA4JtlUWRftXdAbkLh5Y3';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'choreo.5980268.xyz';
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiYzAwYWY1MDhjNzBmMGM4NWQxNmEyY2EyMDAwZTZjYTgiLCJ0IjoiMWM2YjI1NGUtNmRhYi00NjU2LTgxODQtYzQ4NzY4OTYyMGE4IiwicyI6Ik1qSXhaVGhsWVdZdFlqSXhZeTAwWXprNExUaGtOV010WlRVeU1HVmtNVFE0T0RJeSJ9';
const CFIP = process.env.CFIP || 'www.visa.com.tw';
const NAME = process.env.NAME || 'Choreo';

// 路由：根路径
app.get("/", (req, res) => {
  res.send("Hello world!");
});

// 获取当前ISP信息（Cloudflare meta）
let ISP = "Unknown";
try {
  const metaInfo = execSync(
    'curl -s https://speed.cloudflare.com/meta | awk -F\\" \'{print $26"-"$18}\' | sed -e \'s/ /_/g\'',
    { encoding: 'utf-8' }
  );
  ISP = metaInfo.trim();
} catch (e) {
  console.error("Meta ISP 查询失败：", e.message);
}

// 路由：订阅接口
app.get('/sub', (req, res) => {
  const VMESS = {
    v: "2", ps: `${NAME}-${ISP}`, add: CFIP, port: "443", id: UUID,
    aid: "0", scy: "none", net: "ws", type: "none", host: ARGO_DOMAIN,
    path: "/vmess-argo?ed=2048", tls: "tls", sni: ARGO_DOMAIN, alpn: ""
  };

  const vlessURL = `vless://${UUID}@${CFIP}:443?encryption=none&security=tls&sni=${ARGO_DOMAIN}&type=ws&host=${ARGO_DOMAIN}&path=%2Fvless-argo%3Fed%3D2048#${NAME}-${ISP}`;
  const vmessURL = `vmess://${Buffer.from(JSON.stringify(VMESS)).toString("base64")}`;
  const trojanURL = `trojan://${UUID}@${CFIP}:443?security=tls&sni=${ARGO_DOMAIN}&type=ws&host=${ARGO_DOMAIN}&path=%2Ftrojan-argo%3Fed%3D2048#${NAME}-${ISP}`;

  const base64Content = Buffer.from(`${vlessURL}\n\n${vmessURL}\n\n${trojanURL}`).toString("base64");
  res.type("text/plain; charset=utf-8").send(base64Content);
});

// 运行哪吒客户端（v1 版本）
function runNezha() {
  if (NEZHA_SERVER && NEZHA_KEY) {
    const serverParts = NEZHA_SERVER.split(":");
    const port = serverParts[1] || '';
    const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
    const useTLS = tlsPorts.includes(port) ? "--tls" : "";

    const cmd = `nohup ./swith -s ${NEZHA_SERVER} -p ${NEZHA_KEY} ${useTLS} >/dev/null 2>&1 &`;
    try {
      exec(cmd);
      console.log("✅ 哪吒客户端已启动");
      setTimeout(runWeb, 2000);
    } catch (error) {
      console.error("❌ 哪吒启动失败：", error);
    }
  } else {
    console.log("ℹ️ 未配置 NEZHA_SERVER 或 NEZHA_KEY，跳过哪吒启动");
    runWeb();
  }
}

// 启动 xray 核心
function runWeb() {
  const cmd = "nohup ./web -c ./config.json >/dev/null 2>&1 &";
  exec(cmd, (err) => {
    if (err) {
      console.error("❌ xray 启动失败：", err);
    } else {
      console.log("✅ xray 核心已启动");
      setTimeout(runArgo, 2000);
    }
  });
}

// 启动 Argo 隧道
function runArgo() {
  let cmd = "";

  if (/^[A-Za-z0-9=]{120,250}$/.test(ARGO_AUTH)) {
    cmd = `nohup ./server tunnel --region us --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH} >/dev/null 2>&1 &`;
  } else {
    cmd = `nohup ./server tunnel --region us --edge-ip-version auto --config tunnel.yml run >/dev/null 2>&1 &`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.error("❌ Argo 隧道启动失败：", err);
    } else {
      console.log("✅ Argo 隧道已启动");
    }
  });
}

// 启动 Express 服务
app.listen(port, () => {
  console.log(`🚀 控制面板已监听端口 ${port}`);
  runNezha();
});
