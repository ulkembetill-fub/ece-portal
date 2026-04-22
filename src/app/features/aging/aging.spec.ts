import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Aging } from './aging';

describe('Aging', () => {
  let component: Aging;
  let fixture: ComponentFixture<Aging>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Aging],
    }).compileComponents();

    fixture = TestBed.createComponent(Aging);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
