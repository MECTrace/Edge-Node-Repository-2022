export interface ICertificateRes {
  id: string;
  nodeId: string;
  name: string;
  expiredDay: string;
  issuedDate: string;
  createdAt: string;
  updatedAt: string;
  certificateIssue: string;
  status: string;
  isIssued?: boolean;
}

export interface IIssuedCertificate {
  issuedCertificate: ICertificateRes[];
  total: number;
}
