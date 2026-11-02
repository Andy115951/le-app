(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const initial = { net: 48680, expense: 2460, income: 12000 };
  let tab = "assets";
  let additions = 0;
  let amountVisible = true;
  let vaultVisible = true;
  let reverse = false;
  const money = (value) =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const eye =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
  function denomination(value) {
    const minor = Math.max(0, Math.round(value * 100));
    return {
      bars: Math.floor(minor / 1000000),
      coins: Math.floor((minor % 1000000) / 100000),
      nuggets: Math.floor((minor % 100000) / 10000),
      dust: minor % 10000,
    };
  }
  function vaultMarkup(value, hidden = false) {
    const d = denomination(value);
    const image = value >= 100000 ? "safe-reinforced.webp" : "safe-small.webp";
    let contents = "";
    if (!hidden) {
      for (let i = 0; i < Math.min(d.bars, 12); i++)
        contents += `<span class="gold-sprite variant${i % 3}" style="left:${(i % 3) * 26 - 2}%;bottom:${Math.floor(i / 3) * 17}%"></span>`;
      for (let i = 0; i < Math.min(d.coins, 5); i++)
        contents += `<span class="gold-sprite coin ${i % 2 ? "two" : ""}" style="left:${57 + i * 6}%;bottom:${(i % 3) * 7 - 6}%"></span>`;
      for (let i = 0; i < Math.min(d.nuggets, 3); i++)
        contents += `<span class="gold-sprite nugget" style="left:${29 + i * 10}%;bottom:${(i % 2) * 7 - 8}%"></span>`;
      if (d.dust) contents += '<span class="gold-dust"></span>';
    }
    return `<img class="safe-image" src="./assets/${image}" alt="" width="800" height="533"><div class="gold-pile" aria-hidden="true">${contents}</div>`;
  }
  function renderPhone() {
    const net = initial.net - additions * 28;
    const assetValue = amountVisible ? money(net) : "••••";
    if (tab === "assets") {
      $("#phone-screen").innerHTML =
        `<div class="demo-title"><span>净资产</span><button class="eye" type="button" data-action="eye" aria-label="${amountVisible ? "隐藏" : "显示"}演示资产金额" aria-pressed="${amountVisible}">${eye}</button></div><div class="demo-balance"><span>¥ </span>${assetValue}</div><div class="demo-vault-label"><span>我的小金库</span><button class="eye" type="button" data-action="vault-eye" aria-label="${vaultVisible ? "隐藏" : "显示"}演示金库内容" aria-pressed="${vaultVisible}">${eye}</button></div><div class="phone-vault vault-scene" aria-label="${vaultVisible ? "自然光小金库示意" : "金库内容已隐藏"}">${vaultMarkup(net, !vaultVisible)}</div><div class="demo-asset-summary"><div>总资产<strong>${amountVisible ? money(net + 800) : "••••"}</strong></div><div>总负债<strong>${amountVisible ? "800.00" : "••••"}</strong></div></div><div class="demo-account"><span>示例银行卡<small>日常收支</small></span><b>${amountVisible ? money(28500 - additions * 28) : "••••"}</b></div>`;
    } else if (tab === "overview") {
      $("#phone-screen").innerHTML =
        `<div class="demo-title"><span>十月，慢慢记。</span><span>2026.10</span></div><div class="demo-overview-total"><small>本月支出</small><strong>${money(initial.expense + additions * 28)}</strong><div class="demo-overview-row"><div>本月收入<b>${money(initial.income)}</b></div><div>本月结余<b>${money(initial.income - initial.expense - additions * 28)}</b></div></div></div><div class="demo-recent">最近记了这些 <span>↗</span></div>${additions ? '<div class="demo-entry"><span>✓</span><p>试记的午餐<small>仅本页演示 · 不保存</small></p><b>−28.00</b></div>' : ""}<div class="demo-entry"><span>♧</span><p>午餐<small>餐饮 · 示例银行卡</small></p><b>−28.00</b></div><div class="demo-entry"><span>⇢</span><p>地铁<small>交通 · 示例支付宝</small></p><b>−4.00</b></div><div class="demo-entry"><span>↗</span><p>工资<small>收入 · 示例银行卡</small></p><b>+12,000.00</b></div>`;
    } else {
      $("#phone-screen").innerHTML =
        `<div class="demo-title"><span>试着记下一笔午餐</span><span>支出</span></div><div class="demo-input">金额（元）<strong>¥ 28.00</strong></div><div class="demo-form-row"><span>账户</span>示例银行卡</div><div class="demo-form-row"><span>标签</span>吃饭</div><button class="button demo-record" type="button" data-action="record">试记这一笔 <span aria-hidden="true">✓</span></button><p class="demo-success" role="status">${additions ? `已试记 ${additions} 笔，去总览和资产看看变化。` : "仅调整本页示例，不写入真实账本。"}</p><button class="demo-reset" type="button" data-action="reset">重置演示</button>`;
    }
    $("#phone-screen").setAttribute(
      "aria-label",
      `虚构数据演示：${tab === "assets" ? "资产" : tab === "overview" ? "总览" : "记一笔"}`,
    );
    document
      .querySelectorAll("[data-tab]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.tab === tab)),
      );
  }
  function updateVault(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 150000) return;
    const d = denomination(amount);
    $("#vault-value").textContent = `¥ ${money(amount)}`;
    $("#large-vault").innerHTML = vaultMarkup(amount);
    $("#large-vault").setAttribute("role", "img");
    $("#large-vault").setAttribute(
      "aria-label",
      `虚构净资产 ${money(amount)} 元的小金库示意`,
    );
    const parts = [];
    if (d.bars) parts.push(`${d.bars} 块金块`);
    if (d.coins) parts.push(`${d.coins} 枚金币`);
    if (d.nuggets) parts.push(`${d.nuggets} 颗金粒`);
    if (d.dust) parts.push("一点金粉");
    $("#vault-counts").textContent =
      parts.join(" · ") || "空空的小金库，也是一段开始。";
    $("#vault-slider").value = String(amount);
    document.querySelectorAll("[data-amount]").forEach((button) => {
      const selected = Number(button.dataset.amount) === amount;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function showInfo(title, content) {
    $("#dialog-title").textContent = title;
    $("#dialog-content").innerHTML = content;
    $("#info-dialog").showModal();
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.tab) {
      tab = button.dataset.tab;
      renderPhone();
    }
    if (button.dataset.amount) updateVault(button.dataset.amount);
    if (button.dataset.action === "eye") {
      amountVisible = !amountVisible;
      renderPhone();
    }
    if (button.dataset.action === "vault-eye") {
      vaultVisible = !vaultVisible;
      renderPhone();
    }
    if (button.dataset.action === "record") {
      additions++;
      renderPhone();
    }
    if (button.dataset.action === "reset") {
      additions = 0;
      renderPhone();
    }
    if (button.id === "direction-button") {
      reverse = !reverse;
      $(".sync-board").classList.toggle("reverse", reverse);
      $("#sync-copy").innerHTML =
        `${reverse ? "电脑 → 手机" : "手机 → 电脑"}<small>接收方确认后，先备份原账本，再完整替换。</small>`;
      button.setAttribute("aria-pressed", String(reverse));
    }
    if (button.dataset.platform) {
      showInfo(
        `${button.dataset.platform} 测试版`,
        '<p>智账 / 简账目前处于测试阶段，安装包还没有公开发布。</p><p>可以先在本页体验虚构数据演示，或前往开源项目查看最新进展与获取说明。</p><a class="text-link" href="https://github.com/Andy115951/le-app/tree/main/ledger" target="_blank" rel="noopener noreferrer">查看项目与安装说明 <span aria-hidden="true">↗</span></a>',
      );
    }
    if (button.id === "privacy-button") {
      showInfo(
        "你的账本，留在你的设备。",
        "<p>这个官网不连接或读取你的真实账本。页面里的金额、账户和记录全部为虚构数据；演示交互只在当前页面中生效，刷新后重置。</p><p>智账 / 简账的账本保存在应用所在设备上，无需注册账号。只有你主动导出备份或开启局域网传输时，才会把账本交给另一端。</p><p>单独导出的 JSON 备份是明文文件，请妥善保管。官网由 VibeDrop 托管，平台提供基础访问统计；演示本身不会读取或上传你的真实账本。</p>",
      );
    }
    if (
      button.classList.contains("dialog-close") ||
      button.classList.contains("dialog-done")
    )
      $("#info-dialog").close();
  });
  $("#info-dialog").addEventListener("click", (event) => {
    if (event.target === $("#info-dialog")) {
      const rect = event.target.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        event.target.close();
    }
  });
  $("#vault-slider").addEventListener("input", (event) =>
    updateVault(event.target.value),
  );
  renderPhone();
  updateVault(48680);
})();
