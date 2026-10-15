// 즉시 실행 함수로 화면 로직의 변수들이 전역 공간에 흩어지지 않게 감싼다.
// logic.js의 계산 함수와 SubscriptionUI 객체만 페이지 전역에서 연결해 사용한다.
(() => {
  // localStorage에 구독 배열을 저장할 때 사용할 고정 이름이다.
  const STORAGE_KEY = "subscription-tracker-data";

  // HTML 요소를 시작할 때 한 번 찾아 두면, 이벤트 처리 중 반복 검색하지 않아도 된다.
  const form = document.getElementById("subscription-form");
  const formSection = document.getElementById("subscription-form-section");
  const formTitle = document.getElementById("form-title");
  const formMessage = document.getElementById("form-message");
  const list = document.getElementById("subscription-list");
  const sortControl = document.getElementById("subscription-sort");
  const cancelEditButton = document.getElementById("cancel-edit-button");
  const submitButton = document.getElementById("submit-subscription-button");

  // 앱을 시작할 때 브라우저 저장소에서 이전 구독을 읽는다.
  let subscriptions = loadSubscriptions();

  // 저장된 JSON 문자열을 다시 배열로 바꾼다. 첫 방문이거나 손상된 데이터면 빈 배열을 쓴다.
  function loadSubscriptions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("저장된 구독 정보를 읽지 못했습니다.", error);
      return [];
    }
  }

  // 현재 subscriptions 배열을 JSON 문자열로 만들어 브라우저 저장소에 기록한다.
  // 저장 공간이 막혔거나 브라우저가 허용하지 않으면 화면에 안내 문구를 표시한다.
  function saveSubscriptions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
      formMessage.textContent = "";
      return true;
    } catch (error) {
      formMessage.textContent = "저장 공간을 사용할 수 없어 변경 내용을 저장하지 못했습니다.";
      return false;
    }
  }

  // 현재 날짜를 사용자의 현지 달력 기준 "YYYY-MM-DD" 문자열로 만든다.
  // 날짜 비교 함수에 시간 부분이 섞이지 않도록 시간은 포함하지 않는다.
  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // 정렬은 원본 배열을 직접 바꾸지 않도록 복사본(result)에 적용한다.
  // 월 금액은 logic.js의 환산 함수를 이용해 매월/매년 구독을 같은 기준으로 비교한다.
  function sortedSubscriptions() {
    const result = [...subscriptions];
    if (sortControl.value === "amount") {
      result.sort((first, second) => getMonthlyAmount(second) - getMonthlyAmount(first));
    } else if (sortControl.value === "name") {
      result.sort((first, second) => first.name.localeCompare(second.name, "ko"));
    } else {
      result.sort((first, second) => first.nextPaymentDate.localeCompare(second.nextPaymentDate));
    }
    return result;
  }

  // 현재 데이터로 화면의 요약, 목록, 카테고리 영역을 모두 다시 그린다.
  // 이번 주는 오늘(0일)부터 7일 뒤까지로 계산 함수에 전달한다.
  function render() {
    const today = localDateString();
    const upcoming = getUpcomingPayments(subscriptions, today, 7);

    SubscriptionUI.renderSummary({
      monthlyTotal: getTotalMonthlyAmount(subscriptions),
      yearlyTotal: getTotalYearlyAmount(subscriptions),
      upcoming
    });
    SubscriptionUI.renderSubscriptions(sortedSubscriptions(), today);
    SubscriptionUI.renderCategories(getMonthlyAmountByCategory(subscriptions));
  }

  // 입력값과 수정 상태를 초기화해 폼을 새 구독 입력 모드로 되돌린다.
  function clearForm() {
    form.reset();
    document.getElementById("subscription-id").value = "";
    formTitle.textContent = "구독 추가";
    submitButton.textContent = "구독 저장";
    cancelEditButton.classList.add("hidden");
    formMessage.textContent = "";
  }

  // 선택한 구독 값을 폼에 채우고 저장 버튼을 수정 모드로 바꾼다.
  // 숨겨진 id 필드가 채워져 있으면 제출 시 새 항목이 아니라 기존 항목을 갱신한다.
  function beginEdit(subscription) {
    document.getElementById("subscription-id").value = subscription.id;
    document.getElementById("subscription-name").value = subscription.name;
    document.getElementById("subscription-amount").value = subscription.amount;
    document.getElementById("subscription-cycle").value = subscription.cycle;
    document.getElementById("subscription-date").value = subscription.nextPaymentDate;
    document.getElementById("subscription-category").value = subscription.category;
    document.getElementById("subscription-payment-method").value = subscription.paymentMethod || "";
    formTitle.textContent = "구독 수정";
    submitButton.textContent = "변경 내용 저장";
    cancelEditButton.classList.remove("hidden");
    formMessage.textContent = "";
    formSection.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("subscription-name").focus({ preventScroll: true });
  }

  // 폼 제출은 페이지 새로고침 대신 이 함수가 처리한다.
  // FormData는 name 속성이 있는 입력들의 값을 읽고, 숫자 금액과 문자열 필드를 정리한다.
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const id = String(formData.get("id") || "");
    const amount = Number(formData.get("amount"));

    if (!Number.isFinite(amount) || amount <= 0) {
      formMessage.textContent = "결제 금액은 1원 이상 입력해 주세요.";
      return;
    }

    // 새 항목에는 고유 id를 만들고, 수정 중이면 기존 id를 보존한다.
    // UUID를 지원하지 않는 환경을 위해 시간과 임의 문자열을 이용한 대체 id도 준비한다.
    const subscription = {
      id: id || (crypto.randomUUID ? crypto.randomUUID() : `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`),
      name: String(formData.get("name")).trim(),
      amount,
      cycle: String(formData.get("cycle")),
      nextPaymentDate: String(formData.get("nextPaymentDate")),
      category: String(formData.get("category")).trim(),
      paymentMethod: String(formData.get("paymentMethod") || "").trim()
    };

    if (!subscription.name || !subscription.category || !subscription.nextPaymentDate) {
      formMessage.textContent = "필수 항목을 모두 입력해 주세요.";
      return;
    }

    // 숨겨진 id가 있으면 같은 id의 객체만 교체하고, 없으면 배열 끝에 새 객체를 추가한다.
    if (id) {
      subscriptions = subscriptions.map((item) => item.id === id ? subscription : item);
    } else {
      subscriptions.push(subscription);
    }

    saveSubscriptions();
    clearForm();
    render();
  }

  // 카드마다 이벤트를 따로 등록하지 않고 목록의 클릭을 한 곳에서 처리한다.
  // 버튼의 data-action과 data-id를 읽어 수정 또는 삭제 대상을 찾는다.
  function handleListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const subscription = subscriptions.find((item) => item.id === button.dataset.id);
    if (!subscription) return;

    if (button.dataset.action === "edit") {
      beginEdit(subscription);
      return;
    }

    if (button.dataset.action === "delete" && window.confirm(`'${subscription.name}' 구독을 삭제할까요?`)) {
      subscriptions = subscriptions.filter((item) => item.id !== subscription.id);
      saveSubscriptions();
      render();
      if (document.getElementById("subscription-id").value === subscription.id) clearForm();
    }
  }

  // 계산 함수 파일을 읽은 뒤 호출된다. 이 시점에는 logic.js 함수들이 준비되어 있다.
  // 각 화면 입력에 이벤트를 연결하고, 최초 화면을 한 번 렌더링한다.
  function startApp() {
    form.addEventListener("submit", handleSubmit);
    list.addEventListener("click", handleListClick);
    sortControl.addEventListener("change", render);
    cancelEditButton.addEventListener("click", clearForm);
    document.getElementById("add-subscription-button").addEventListener("click", () => {
      clearForm();
      formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("subscription-name").focus({ preventScroll: true });
    });
    render();
  }

  // 기존 logic.js의 예제 로그가 참조하는 testData 이름을 빈 배열로 제공한다.
  // 외부 라이브러리나 모듈 빌드 없이 script 요소를 추가해 계산 함수를 불러온다.
  // onload 이후에 앱을 시작해 계산 함수가 아직 없는 상태에서 render되지 않게 한다.
  function loadLogic() {
    window.testData = [];
    const script = document.createElement("script");
    script.src = "js/logic.js";
    script.onload = startApp;
    script.onerror = () => {
      document.getElementById("subscription-list").innerHTML = '<div class="empty-state">계산 함수를 불러오지 못했습니다. js/logic.js 파일을 확인해 주세요.</div>';
    };
    document.head.appendChild(script);
  }

  loadLogic();
})();