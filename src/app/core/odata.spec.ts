import { TestBed } from '@angular/core/testing';

import { Odata } from './odata';

describe('Odata', () => {
  let service: Odata;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Odata);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
