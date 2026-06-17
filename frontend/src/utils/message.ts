import { message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

let globalMessage: MessageInstance | null = null;

export const setGlobalMessage = (msg: MessageInstance) => {
  globalMessage = msg;
};

export const getGlobalMessage = (): MessageInstance => {
  return globalMessage ?? staticMessage;
};
