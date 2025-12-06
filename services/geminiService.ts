import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const analyzeSpending = async (transactions: Transaction[]): Promise<string> => {
  // Use process.env.API_KEY directly as per guidelines.
  // Assume it is available in the environment.
  if (!process.env.API_KEY) return "请配置 API Key 以使用智能分析功能。";

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prepare a lightweight summary to send to LLM
    const summary = transactions.slice(0, 50).map(t => ({
      date: t.date.split('T')[0],
      type: t.type,
      category: t.category,
      amount: t.amount,
      currency: t.currency,
      method: t.paymentMethod,
      cny: t.calculatedCNY
    }));

    const prompt = `
      作为一个财务分析师，请根据以下留学生的近期前50笔账单数据（JSON格式），
      用中文给出一段简短、犀利且幽默的财务评价（150字以内）。
      重点关注是否有冲动消费，以及汇率管理是否得当。
      
      数据: ${JSON.stringify(summary)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "无法生成分析。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "智能分析暂时不可用，请稍后再试。";
  }
};