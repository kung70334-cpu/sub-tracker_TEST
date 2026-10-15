// 구독 객체는 이 파일의 계산 함수들이 공통으로 사용하는 데이터 모양이다.
// id는 항목을 구별하고, name/amount/cycle은 서비스와 금액을 나타낸다.
// cycle에는 "monthly"(매월) 또는 "yearly"(매년)를 사용한다.
// nextPaymentDate는 "YYYY-MM-DD" 형식이고, category와 paymentMethod는 화면 분류용이다.
// 예시: { id: "sub_1", name: "넷플릭스", amount: 13500, cycle: "monthly",
//         nextPaymentDate: "2026-10-20", category: "영상", paymentMethod: "신한카드" }

// 한 구독의 실제 결제 금액을 월간 기준 금액으로 바꾼다.
// 매년 결제하는 상품은 연 금액을 12로 나눈 뒤 원 단위 정수로 반올림한다.
// 반환값은 화면의 월 합계와 카테고리별 월 합계 계산에 재사용된다.
function getMonthlyAmount(subscription) {
    if (subscription.cycle === "yearly") {
        return Math.round(subscription.amount / 12);
    }
    return subscription.amount;
}
// 구독 배열을 받아 모든 항목을 월 기준 금액으로 환산해 더한다.
// for...of는 배열 안의 구독 객체를 하나씩 subscription 변수에 담는다.
function getTotalMonthlyAmount(subscriptions) {
    let total = 0;
    for (const subscription of subscriptions) {
        total += getMonthlyAmount(subscription);
    }  
    return total;
}
// 월간 총액을 먼저 구한 다음 12를 곱해 연간 기준 합계를 만든다.
// 따라서 연간 결제도 getMonthlyAmount에서 월 금액으로 나눈 뒤 연 환산된다.
function getTotalYearlyAmount(subscriptions) {
    const totalMonthly = getTotalMonthlyAmount(subscriptions);
    return totalMonthly * 12;
}   
// 오늘 날짜와 결제 날짜(둘 다 "YYYY-MM-DD") 사이의 일수 차이를 계산한다.
// 문자열을 Date 객체로 바꾸면 날짜끼리 빼서 밀리초 차이를 얻을 수 있다.
// 하루의 밀리초로 나누어 일수로 바꾸며, 오늘은 0일, 과거 날짜는 음수다.
function getDaysUntilPayment(today, nextPaymentDate) {
    const todayDate = new Date(today);
    const paymentDate = new Date(nextPaymentDate);
    const diffTime = paymentDate - todayDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
// 오늘부터 지정한 days일 뒤까지 결제되는 구독만 새 배열에 담아 돌려준다.
// daysUntil이 0인 오늘 결제도 포함하고, 음수인 이미 지난 결제는 제외한다.
function getUpcomingPayments(subscriptions, today, days) {
    const upcoming = [];
    for (const subscription of subscriptions) {
        const daysUntil = getDaysUntilPayment(today, subscription.nextPaymentDate);
        if (daysUntil >= 0 && daysUntil <= days) {
            upcoming.push(subscription);
        }
    }
    return upcoming;
}
// 카테고리 이름을 객체의 키로 사용해 월 기준 지출을 누적한다.
// 같은 카테고리가 처음 나오면 0으로 초기화하고, 이후 구독 금액을 더한다.
// 반환 예: { "영상": 13500, "음악": 10900 }
function getMonthlyAmountByCategory(subscriptions) {
    const categoryTotals = {};
    for (const subscription of subscriptions) {
        const category = subscription.category;
        const monthlyAmount = getMonthlyAmount(subscription);
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += monthlyAmount;
    }
    return categoryTotals;
}   

// 결제 수단별 월 지출을 누적한다. paymentMethod가 비어 있으면 "미지정"으로 묶는다.
// 내부 계산에는 yearly 구독도 월 환산한 금액을 사용한다.
// 반환 예: { "신한카드": 23500, "삼성카드": 10900 }
function getMonthlyAmountByPaymentMethod(subscriptions) {
    const paymentTotals = {};
    for (const subscription of subscriptions) {
        const paymentMethod = subscription.paymentMethod || "미지정";
        const monthlyAmount = getMonthlyAmount(subscription);
        if (!paymentTotals[paymentMethod]) {
            paymentTotals[paymentMethod] = 0;
        }
        paymentTotals[paymentMethod] += monthlyAmount;
    }
    return paymentTotals;
}

// 카드별 월 합계를 먼저 구한 뒤, 각 카드 금액에 12를 곱해 연간 합계로 바꾼다.
// getMonthlyAmountByPaymentMethod를 재사용하므로 미지정 결제수단 처리도 동일하다.
function getYearlyAmountByPaymentMethod(subscriptions) {
    const monthlyTotals = getMonthlyAmountByPaymentMethod(subscriptions);
    const yearlyTotals = {};
    for (const paymentMethod in monthlyTotals) {
        yearlyTotals[paymentMethod] = monthlyTotals[paymentMethod] * 12;
    }
    return yearlyTotals;
}

// 아래 로그는 함수 결과를 콘솔에서 바로 확인하기 위한 예제다.
// 이 파일만 단독 실행할 때는 testData 배열을 먼저 준비해야 한다.
// 웹페이지에서는 js/main.js가 빈 testData 배열을 준비한 뒤 이 파일을 불러온다.
console.log("월 합계:", getTotalMonthlyAmount(testData));
console.log("연 합계:", getTotalYearlyAmount(testData));
console.log("카테고리별(월):", getMonthlyAmountByCategory(testData));
console.log("카드별 월 합계:", getMonthlyAmountByPaymentMethod(testData));
console.log("카드별 연 합계:", getYearlyAmountByPaymentMethod(testData));