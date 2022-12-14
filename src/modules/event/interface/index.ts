export interface IEventResult {
  event_id: string;
  event_sendNodeId: string;
  event_receiveNodeId: string;
  event_fileId: string;
  event_status: string;
  event_createdAt: string;
  event_updatedAt: string;
}

export interface IGetBySendNodeId {
  fileId: string;
  sendNode: string;
  sendNodeId: string;
  receiveNodeId: string;
  receiveNode: string;
  status: string;
  createdAt: string;
  fileType: string;
}

export interface IInsertResult {
  raw: [{ id: string }];
}
