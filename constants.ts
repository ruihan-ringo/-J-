
import { Currency, PaymentMethod } from "./types";

export const INCOME_CATEGORIES = [
  "生活费 (Living Allowance)",
  "工资 (Salary)",
  "礼金 (Gift/Red Packet)",
  "理财收益 (Investment)",
  "其他 (Other)"
];

export const EXPENSE_CATEGORIES = [
  "餐费 (Food)",
  "住宿费 (Housing)",
  "零食饮料 (Snacks)",
  "日用品 (Groceries)",
  "交通 (Transport)",
  "充会员 (Subscriptions)",
  "玩耍 (Entertainment)",
  "学费 (Tuition)",
  "购物 (Shopping)",
  "其他 (Other)"
];

export const CURRENCY_OPTIONS = Object.values(Currency);

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH_DEBIT]: "现金 / 借记卡 (消耗外币存款)",
  [PaymentMethod.CREDIT_CARD]: "信用卡 (记账，还款时结算)",
  [PaymentMethod.DIGITAL]: "微信 / 支付宝 (实时折算)",
  [PaymentMethod.NONE]: "人民币支付",
};
