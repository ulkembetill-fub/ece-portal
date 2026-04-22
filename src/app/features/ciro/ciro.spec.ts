import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ciro } from './ciro';

describe('Ciro', () => {
  let component: Ciro;
  let fixture: ComponentFixture<Ciro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ciro],
    }).compileComponents();

    fixture = TestBed.createComponent(Ciro);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
