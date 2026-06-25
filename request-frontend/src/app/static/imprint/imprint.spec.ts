import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ImprintComponent } from './imprint';

describe('ImprintComponent', () => {
  let component: ImprintComponent;
  let fixture: ComponentFixture<ImprintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImprintComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImprintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the Hack4Rail attribution and OpenRail Association as operator', () => {
    const html = fixture.nativeElement.textContent ?? '';
    expect(html).toContain('Hack4Rail 2026');
    expect(html).toContain('OpenRail Association');
    expect(html).toContain('Avenue des Arts 53');
  });
});
