import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tahsilat } from './tahsilat';

describe('Tahsilat', () => {
  let component: Tahsilat;
  let fixture: ComponentFixture<Tahsilat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tahsilat],
    }).compileComponents();

    fixture = TestBed.createComponent(Tahsilat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
