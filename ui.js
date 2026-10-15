// 화면에 HTML 조각을 그리는 함수만 모아 전역 객체 하나로 공개한다.
// 데이터 저장이나 폼 이벤트는 main.js가 담당하고, 이 파일은 표시만 맡는다.
(() => {
  // 사용자가 입력한 문자열을 HTML에 넣기 전에 특수문자를 문자 그대로 보이게 바꾼다.
  // 이를 통해 이름에 < 나 따옴표가 있어도 태그나 속성으로 실행되지 않게 한다.
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  // 숫자를 한국식 천 단위 쉼표로 표시하고 뒤에 원 단위를 붙인다.
  const formatMoney = (amount) => `${Number(amount || 0).toLocaleString("ko-KR")}원`;

  // 날짜 문자열을 사람이 읽기 쉬운 표시 형태로 바꾼다.
  // 값이 비어 있을 때도 화면이 어색하지 않도록 대체 문구를 돌려준다.
  const formatDate = (dateString) => {
    if (!dateString) return "결제일 미정";
    const [year, month, day] = dateString.split("-").map(Number);
    return `${year}. ${month}. ${day}. 결제`;
  };

  // 계산된 월/연 총액과 예정 결제 배열을 상단 요약 영역에 표시한다.
  // 일정 이름은 너무 길어지지 않도록 최대 두 개까지만 보조 문구로 보여준다.
  function renderSummary({ monthlyTotal, yearlyTotal, upcoming }) {
    document.getElementById("monthly-total").textContent = formatMoney(monthlyTotal);
    document.getElementById("yearly-total").textContent = formatMoney(yearlyTotal);
    document.getElementById("upcoming-count").textContent = `${upcoming.length}건`;

    const caption = upcoming.length
      ? upcoming.slice(0, 2).map((subscription) => subscription.name).join(", ")
      : "예정된 결제가 없습니다";
    document.getElementById("upcoming-caption").textContent = caption;
  }

  // 정렬된 구독 배열을 카드 목록으로 바꾼다. 오늘 날짜도 받아 각 카드의 D-day를 계산한다.
  // 구독이 0개면 빈 상태를 보여주고, 항목이 있으면 카드마다 수정/삭제 버튼을 만든다.
  function renderSubscriptions(subscriptions, today) {
    const list = document.getElementById("subscription-list");
    document.getElementById("subscription-count").textContent = subscriptions.length;

    if (!subscriptions.length) {
      list.innerHTML = '<div class="empty-state">아직 등록된 구독이 없습니다.<br>오른쪽에서 첫 구독을 추가해 보세요.</div>';
      return;
    }

    // map은 구독 객체를 HTML 문자열로 바꾸고, join으로 카드들을 하나의 문자열로 합친다.
    list.innerHTML = subscriptions.map((subscription) => {
      const monthlyAmount = getMonthlyAmount(subscription);
      const daysUntil = getDaysUntilPayment(today, subscription.nextPaymentDate);
      const dayLabel = daysUntil < 0 ? `D+${Math.abs(daysUntil)}` : `D-${daysUntil}`;
      const paymentMethod = subscription.paymentMethod ? ` · ${escapeHTML(subscription.paymentMethod)}` : "";

      return `
        <article class="subscription-card">
          <div class="subscription-main">
            <div class="subscription-title-line">
              <h3 class="subscription-name">${escapeHTML(subscription.name)}</h3>
              <span class="category-tag">${escapeHTML(subscription.category)}</span>
            </div>
            <div class="subscription-meta">
              <span>${formatDate(subscription.nextPaymentDate)}</span>
              <span>${dayLabel}</span>
              <span>${subscription.cycle === "yearly" ? "연간 결제" : "월간 결제"}${paymentMethod}</span>
            </div>
          </div>
          <strong class="subscription-amount">${formatMoney(monthlyAmount)} <small>/월</small></strong>
          <div class="subscription-actions">
            <button class="text-button" type="button" data-action="edit" data-id="${escapeHTML(subscription.id)}" aria-label="${escapeHTML(subscription.name)} 수정">수정</button>
            <button class="text-button text-button-delete" type="button" data-action="delete" data-id="${escapeHTML(subscription.id)}" aria-label="${escapeHTML(subscription.name)} 삭제">삭제</button>
          </div>
        </article>
      `;
    }).join("");
  }

  // logic.js가 반환한 { 카테고리: 월 금액 } 객체를 비중 막대 목록으로 표시한다.
  // 가장 큰 지출부터 정렬하고 전체 월 금액에서 차지하는 퍼센트를 계산한다.
  function renderCategories(categoryTotals) {
    const list = document.getElementById("category-list");
    const categories = Object.entries(categoryTotals)
      .filter(([, amount]) => amount > 0)
      .sort((first, second) => second[1] - first[1]);
    const total = categories.reduce((sum, [, amount]) => sum + amount, 0);

    if (!categories.length || total <= 0) {
      list.innerHTML = '<p class="category-empty">구독을 추가하면 카테고리별 지출이 표시됩니다.</p>';
      return;
    }

    list.innerHTML = categories.map(([category, amount]) => {
      const percentage = Math.round((amount / total) * 100);
      return `
        <div class="category-row">
          <span class="category-name">${escapeHTML(category)} <span class="category-value">${percentage}%</span></span>
          <span class="category-value">${formatMoney(amount)}</span>
          <span class="category-track" aria-label="${escapeHTML(category)} 비중 ${percentage}%">
            <span class="category-bar" style="width: ${percentage}%"></span>
          </span>
        </div>
      `;
    }).join("");
  }

  // main.js가 이 세 렌더링 함수를 호출할 수 있도록 하나의 전역 객체로 내보낸다.
  window.SubscriptionUI = { renderSummary, renderSubscriptions, renderCategories };
})();