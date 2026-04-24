import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OdataService {

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const creds = btoa(environment.odata.user + ':' + environment.odata.pass);
    return new HttpHeaders({
      'Authorization': 'Basic ' + creds,
      'Accept': 'application/json',
    });
  }

  getTurnover(year: number) {
    const url = `${environment.odata.url}?$filter=Year eq ${year}&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getContracts() {
    const baseUrl = environment.odata.url.replace(/\/ContractTurnoverEntry.*/, '');
    const url = `${baseUrl}/ContractList?$select=No,SectorName,SubSectorName&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }
}