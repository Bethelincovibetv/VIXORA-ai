import { PAYSTACK_SECRET_KEY } from '../constants';
import { Bank } from '../types';

const BASE_URL = 'https://api.paystack.co';

export const fetchBanks = async (): Promise<Bank[]> => {
  try {
    const response = await fetch(`${BASE_URL}/bank`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching banks:', error);
    return [];
  }
};

export const fetchSubaccount = async (subaccountCode: string) => {
  try {
    const response = await fetch(`${BASE_URL}/subaccount/${subaccountCode}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching subaccount:', error);
    throw error;
  }
};

export const fetchSettlements = async (subaccountCode: string) => {
  try {
    // Paystack allows filtering settlements by subaccount code
    const response = await fetch(`${BASE_URL}/settlement?subaccount=${subaccountCode}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching settlements:', error);
    throw error;
  }
};

export const createSubaccount = async (params: {
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
}) => {
  try {
    const response = await fetch(`${BASE_URL}/subaccount`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating subaccount:', error);
    throw error;
  }
};
